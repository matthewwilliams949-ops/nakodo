# Directory & registry submissions — launch checklist

*2026-07-10 · Motion 2 prep. Updated 2026-07-11 (CTO): the planned 0.1.1 was superseded by 0.2.0 — M8 folded the registry marker + perspective-led tool descriptions into the seed build, so there is still exactly one security-key publish before post #1. Everything here happens AFTER: (1) 0.2.0 npm publish, (2) repo flipped public. Order matters: npm → GitHub public → official registry → the rest (several directories auto-index the official registry).*

## 0. Pre-flight (blockers)

- [ ] `nakodo@0.2.0` on npm (includes `mcpName: "dev.nakodo/nakodo"` — the registry's package-verification marker; the published 0.1.0 lacks it, which is why the registry submission waits on the 0.2.0 publish)
- [ ] GitHub repo `matthewwilliams949-ops/nakodo` → public (history verified clean of secrets, 2026-07-10)
- [ ] Trademark flag from the brand guide resolved or accepted ("Nakoda" read — SCOPE.md open flag)

## 1. Official MCP Registry (highest value — others index it)

Namespace choice: **`dev.nakodo/nakodo`** (brand-clean, we own nakodo.dev) — requires DNS verification. Steps:

1. `brew install mcp-publisher` (or download release binary)
2. `cd packages/mcp-server && mcp-publisher login dns --domain nakodo.dev` — it prints a TXT record; **Matthew adds it** at the DNS host (same place as the Resend SPF/DKIM records), then verification completes
3. `mcp-publisher publish --dry-run` → fix anything → `mcp-publisher publish`
4. Verify: `curl "https://registry.modelcontextprotocol.io/v0/servers?search=nakodo"`

*Fallback if DNS is a hassle: GitHub namespace `io.github.matthewwilliams949-ops/nakodo` via `mcp-publisher login github` — works, uglier name, and `mcpName` in package.json + server.json must be changed to match before publishing 0.2.0 (decide BEFORE the npm publish).*

## 2. Directories

- [ ] **Smithery** (smithery.ai) — claim/add server; needs the public GitHub repo
- [ ] **mcp.so** — submit form / GitHub issue on chatmcp/mcp-directory
- [ ] **PulseMCP** — indexes the official registry automatically; verify listing appears ~launch week, submit manually if not
- [ ] **Glama, mcp-get, others** — batch-submit launch week; most scrape the official registry, so #1 does the heavy lifting

## 3. Attribution instrumentation (already live)

Registration captures `source` ("how did the agent find this server") — watch for "registry search" answers post-listing; that's the Motion-3 (agent-pull) signal, the channel nobody else owns.
