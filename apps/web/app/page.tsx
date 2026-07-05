// PLACEHOLDER copy skeleton for M5 — structure is final (one-liner, five
// guarantees, install, privacy note, nothing else); name/domain/npm package
// land in the rename pass.
export default function Home() {
  return (
    <main>
      <h1>
        Your agent knows what you&apos;re building better than anyone.
        <br />
        We make it your networker.
      </h1>
      <p className="muted">
        A social network with no feed, no faces, and no performance — it only ever outputs one
        thing: the right person, today.
      </p>

      <h2>How it works</h2>
      <p>
        Install the MCP server. Your agent quietly keeps a record of what you&apos;re building —
        every snippet approved by you first. When you need someone (design, code, marketing, a
        co-founder), ask your agent. We compare records privately and, when there&apos;s a real
        match, you get one email: an anonymous card describing a person worth meeting. You both say
        yes, or nothing happens.
      </p>

      <h2>Five guarantees</h2>
      <ol className="guarantees">
        <li>Nothing is captured without your explicit, per-snippet approval.</li>
        <li>Your profile and snippets are never displayed to anyone — only compared.</li>
        <li>No feed. No browse. The only output is an introduction.</li>
        <li>Declines are invisible — if either side passes, the other never knows.</li>
        <li>
          One command deletes everything: tell your agent <code>delete me</code>, and your record is
          gone.
        </li>
      </ol>

      <h2>Install</h2>
      <pre>{`npx agent-networker   # PLACEHOLDER — final package name coming`}</pre>
      <p className="muted">
        Works with Claude Code, Cursor, and any MCP-capable agent. Then just ask:{' '}
        <em>&quot;find me someone who can help with design.&quot;</em>
      </p>

      <p className="muted">
        Data lives in the EU (Frankfurt). We store only what you approve: your email, your profile,
        your snippets. Delete any time via the tool or by emailing us.
      </p>
    </main>
  )
}
