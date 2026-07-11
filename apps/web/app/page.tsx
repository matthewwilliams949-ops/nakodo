// M5 rule: one-liner, five guarantees, install, privacy note — nothing else.
// Site pass 2026-07-11 (documentation/design/site-pass.md): a builder arriving
// from a launch post already has the pitch — install is the 60-second job, so
// it comes first; the guarantees close the trust; depth reads last.
import { CopyCommand } from './CopyCommand'

export default function Home() {
  return (
    <main>
      <h1 className="cursor">
        Your agent knows what you&apos;re building — and when an outside perspective would move it
        forward.
        <br />
        Nakodo finds that person and makes the warm intro.
      </h1>
      <p className="muted">
        No feed, no faces, no performance — it only ever outputs one thing: the right person.
        Honest feedback today, a collaborator tomorrow, maybe your co-founder.
      </p>

      <h2>Install</h2>
      <ol className="steps">
        <li>
          Copy this command:
          <CopyCommand command="claude mcp add nakodo -- npx -y nakodo" />
        </li>
        <li>
          Paste it into your terminal — the same window where you talk to Claude Code — and press
          enter. A line confirms nakodo was added.
        </li>
        <li>
          Next time you&apos;re working, just ask:{' '}
          <em>&quot;find me someone who can help with design.&quot;</em> Your agent takes it from
          there — including setting up your profile, every word approved by you first.
        </li>
      </ol>
      <p className="muted">
        Not on Claude Code? Any MCP-capable agent works. In Cursor: Settings → MCP → Add server —
        the command is <code>npx -y nakodo</code>.
      </p>

      <h2>Five guarantees</h2>
      <ol className="guarantees">
        <li>Nothing is captured without your explicit, per-snippet approval.</li>
        <li>
          Your profile carries no identity — no name, no links, nothing personally identifying;
          agents match on the work, not the person. Identity and contact live separately, revealed
          only when you both say yes.
        </li>
        <li>
          No feed. No human browse surface. Agents search so humans don&apos;t scroll — the only
          human-visible output is an introduction.
        </li>
        <li>
          Declines are invisible — and so is being considered: candidates an agent passes over never
          know.
        </li>
        <li>
          One command deletes everything: tell your agent <code>delete me</code>, and your record is
          gone.
        </li>
      </ol>

      <h2>How it works</h2>
      <p className="muted">
        <em>Nakōdo (仲人): the traditional Japanese matchmaker — the discreet go-between who knows
        both sides, and only speaks when there&apos;s a real match.</em>
      </p>
      <p>
        Your agent quietly keeps a record of what you&apos;re building — every snippet approved by
        you first. When you need someone (design, code, marketing, a co-founder), ask it: your agent
        searches a pool of profiles that carry no identity and proposes the introduction, and a
        human reviews every proposal before it reaches anyone. What arrives is an anonymous card
        describing a person worth meeting, on a private page. You both say yes, or nothing happens.
        After a yes, the card becomes a person — the name they chose to be called, and a private
        thread where you two take it from there. Nothing is ever sent on your behalf.
      </p>

      <p className="muted">
        Data lives in the EU (Frankfurt). We store only what you approve: your profile, your
        snippets, and — only if you choose to leave one — an email used solely to tell you an
        introduction is waiting. Delete any time via the tool or by emailing{' '}
        <a href="mailto:hello@nakodo.dev">hello@nakodo.dev</a>.
      </p>
    </main>
  )
}
