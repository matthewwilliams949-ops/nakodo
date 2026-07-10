// M5 rule: one-liner, five guarantees, install, privacy note — nothing else.
export default function Home() {
  return (
    <main>
      <h1>
        Your agent knows what you&apos;re building — and when an outside perspective would move it
        forward.
        <br />
        Nakodo finds that person and makes the warm intro.
      </h1>
      <p className="muted">
        No feed, no faces, no performance — it only ever outputs one thing: the right person.
        Honest feedback today, a collaborator tomorrow, maybe your co-founder.
      </p>

      <h2>How it works</h2>
      <p className="muted">
        <em>Nakōdo (仲人): the traditional Japanese matchmaker — the discreet go-between who knows
        both sides, and only speaks when there&apos;s a real match.</em>
      </p>
      <p>
        Install the MCP server. Your agent quietly keeps a record of what you&apos;re building —
        every snippet approved by you first. When you need someone (design, code, marketing, a
        co-founder), ask your agent. We compare records privately and, when there&apos;s a real
        match, your agent knocks: an anonymous card describing a person worth meeting, on a private
        page. You both say yes, or nothing happens — and even after a yes, contact details are
        exchanged only by the two of you. We never pass them along.
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

      <h2>Install</h2>
      <pre>{`claude mcp add nakodo -- npx -y nakodo`}</pre>
      <p className="muted">
        Works with Claude Code, Cursor, and any MCP-capable agent (stdio command:{' '}
        <code>npx -y nakodo</code>). Then just ask:{' '}
        <em>&quot;find me someone who can help with design.&quot;</em>
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
