-- Canonical schema. Applied with `pnpm db:apply` (idempotent).
-- Trust rules live in the structure:
--   * deleting a user cascades profiles/snippets/asks and anonymizes their
--     side of intros and events (SET NULL) — this is what `delete_me` relies on
--   * declines only ever set intros.status; nothing is written to or sent at
--     the other party (rejection is invisible in both directions)

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  handle text,
  location text,
  token_hash text not null unique,
  source text, -- attribution: how the agent found the server (Motion 3 instrument)
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  user_id uuid primary key references users(id) on delete cascade,
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
  card_a text not null, -- anonymous card shown TO user_a (describes user_b)
  card_b text not null, -- anonymous card shown TO user_b (describes user_a)
  a_response text check (a_response in ('accepted', 'declined')),
  a_responded_at timestamptz,
  b_response text check (b_response in ('accepted', 'declined')),
  b_responded_at timestamptz,
  status text not null default 'proposed'
    check (status in ('proposed', 'revealed', 'declined')),
  token_a text not null unique,
  token_b text not null unique,
  token_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
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
