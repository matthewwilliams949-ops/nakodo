-- Canonical schema. Applied with `pnpm db:apply` (idempotent).
-- Trust rules live in the structure:
--   * deleting a user cascades profiles/snippets/asks and anonymizes their
--     side of intros and events (SET NULL) — this is what `delete_me` relies on
--   * declines only ever set intros.status; nothing is written to or sent at
--     the other party (rejection is invisible in both directions)

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  -- v1.1: optional. Notification channel only — never shared, never shown to a
  -- match, not required to participate. Contact exchange happens in-app.
  email text unique,
  handle text,
  -- M8: what a match may call this person after a mutual yes. PII store only —
  -- shown on the revealed intro page, never in any card or pool response.
  display_name text,
  location text,
  token_hash text not null unique,
  source text, -- attribution: how the agent found the server (Motion 3 instrument)
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  user_id uuid primary key references users(id) on delete cascade,
  -- M8: the pool identifier. Opaque and stable, NEVER the user id — pool
  -- responses carry card_id only, so nothing in the pool joins to identity.
  card_id uuid not null unique default gen_random_uuid(),
  body text not null, -- agent-synthesized, human-approved
  approved_at timestamptz not null default now()
);

create table if not exists snippets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists asks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  need text not null,
  status text not null default 'open' check (status in ('open', 'matched', 'closed')),
  created_at timestamptz not null default now()
);

-- Per-side responses are tracked separately so rejection stays invisible:
-- after one side declines, the other side's link must keep behaving exactly
-- as if the intro were still pending. Each side's view is rendered ONLY from
-- its own response + whether the intro revealed.
create table if not exists intros (
  id uuid primary key default gen_random_uuid(),
  user_a uuid references users(id) on delete set null,
  user_b uuid references users(id) on delete set null,
  -- M8: agent-proposed intros carry their proposer (null = concierge) and the
  -- ask they answer. SET NULL on user delete: delete_me anonymizes proposals.
  proposed_by uuid references users(id) on delete set null,
  ask_id uuid references asks(id) on delete set null,
  card_a text not null, -- anonymous card shown TO user_a (describes user_b)
  card_b text not null, -- anonymous card shown TO user_b (describes user_a)
  a_response text check (a_response in ('accepted', 'declined')),
  a_responded_at timestamptz,
  b_response text check (b_response in ('accepted', 'declined')),
  b_responded_at timestamptz,
  -- M8: 'held' = agent-proposed, awaiting seed-phase review; 'vetoed' = review
  -- said no. Both must be invisible to the target: token lookups exclude them
  -- (lib/intros.ts) and the pending endpoint only lists 'proposed'. A veto is
  -- exactly as silent as a decline — the proposer (a_response already
  -- 'accepted' from proposing) sees 'waiting' nowhere, because their token URL
  -- is never handed out before reveal.
  status text not null default 'proposed'
    check (status in ('held', 'vetoed', 'proposed', 'revealed', 'declined')),
  token_a text not null unique,
  token_b text not null unique,
  token_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- M8: the intro thread. Messages are person-to-person — the platform stores
-- and displays them on the two intro pages, never emails their content.
-- HARD RULE: threads exist only inside mutually-accepted intros; writes are
-- refused unless the intro is revealed (lib/intros.ts, regression-pinned).
-- sender_id cascades so delete_me removes a user's messages; side (not sender)
-- drives rendering so the surviving thread still displays correctly.
create table if not exists intro_messages (
  id uuid primary key default gen_random_uuid(),
  -- THE thread-ordering key. created_at collides at microsecond speed and the
  -- uuid tiebreak is random, which scrambled thread order and misfired the
  -- ball-crossing nudge (found 2026-07-11); order by seq, never created_at.
  seq bigint generated always as identity,
  intro_id uuid not null references intros(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade,
  side text not null check (side in ('a', 'b')),
  body text not null,
  created_at timestamptz not null default now()
);

-- M9-0: agent-collected feedback. Guarantee 1 EXTENDED, not excepted: rows
-- exist only because the user approved the exact text in-session (the MCP
-- tool owns that gate). INTERNAL-ONLY: read by the humans building Nakodo
-- via the admin digest (pnpm feedback) — there is no read endpoint, nothing
-- here ever enters the pool or any API response (regression-pinned), and it
-- is never used for matching. delete_me cascades it (guarantee 5).
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  -- Nakodo's own moments only (the share_feedback trigger list) — the enum is
  -- the boundary against general emotional monitoring.
  moment text not null check (moment in ('onboarding', 'cards', 'intro_quality', 'reveal', 'thread', 'waiting')),
  sentiment text not null check (sentiment in ('positive', 'neutral', 'negative', 'mixed')),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id bigint generated always as identity primary key,
  install_id text,
  user_id uuid references users(id) on delete set null,
  type text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists events_type_idx on events (type, created_at);
create index if not exists snippets_user_idx on snippets (user_id, created_at);
create index if not exists asks_user_idx on asks (user_id, status);
create index if not exists intro_messages_intro_seq_idx on intro_messages (intro_id, seq);

-- v1.1 trust redesign (2026-07-09) — idempotent migrations for existing databases.
-- Email becomes optional (notification-only). (The v1.1 a_contact/b_contact
-- columns are superseded by intro_messages; the M8 block below folds them.)
alter table users alter column email drop not null;

-- M8 agent-driven matching (2026-07-10) — idempotent migrations for existing
-- databases. New columns, the 'held' pre-review status, and the intro thread.
alter table users add column if not exists display_name text;
alter table profiles add column if not exists card_id uuid not null unique default gen_random_uuid();
alter table intros add column if not exists proposed_by uuid references users(id) on delete set null;
alter table intros add column if not exists ask_id uuid references asks(id) on delete set null;
alter table intros drop constraint if exists intros_status_check;
alter table intros add constraint intros_status_check
  check (status in ('held', 'vetoed', 'proposed', 'revealed', 'declined'));

-- Thread-ordering fix (2026-07-11): insertion-ordered seq replaces the
-- created_at/uuid sort (collision-prone; see intro_messages above). Existing
-- rows backfill in table order — fine at current volume.
alter table intro_messages add column if not exists seq bigint generated always as identity;
drop index if exists intro_messages_intro_idx;
create index if not exists intro_messages_intro_seq_idx on intro_messages (intro_id, seq);

-- Fold v1.1 contact shares into the thread as its first messages, then drop
-- the columns. Contacts left by a since-deleted user are skipped: their
-- content dies with them (guarantee 5), same as the sender_id cascade.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'intros' and column_name = 'a_contact'
  ) then
    insert into intro_messages (intro_id, sender_id, side, body, created_at)
      select id, user_a, 'a', a_contact, coalesce(resolved_at, created_at)
      from intros where a_contact is not null and user_a is not null;
    insert into intro_messages (intro_id, sender_id, side, body, created_at)
      select id, user_b, 'b', b_contact, coalesce(resolved_at, created_at)
      from intros where b_contact is not null and user_b is not null;
    alter table intros drop column a_contact;
    alter table intros drop column b_contact;
  end if;
end $$;
