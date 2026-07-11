# Accepted tech debt

*Owner: CTO. Deliberate, owned decisions — reviewers: don't re-surface items here unless the surrounding facts changed. Format: what · why accepted · revisit-when.*

| What | Why accepted | Revisit when |
|---|---|---|
| `api-client.ts` stale "not-yet-shipped" comments + dead fallbacks (Tech Review 2026-07-11, F3) | Cosmetic; zero behavior. | Next 0.2.x session touching that file deletes them. |
| PII instruction-lint is conservative regexes; novel phrasings pass | By design — lint is one of three layers (untrusted-data framing + held-review behind it). | Held-review toggle turns off, or a real bypass is observed. |
| `sweep`/`e2e-harness` timing-window row matching for untagged cleanup | Ops tooling, founder-run, tiny data volumes. | Prod data volume makes windows ambiguous. |
| Thread-ordering regression pin is probabilistic (relies on same-microsecond collisions; ~1-in-4 repro) | Trust review n1: real signal, cheap test. | Anyone next edits `intro_messages` tests — add the deterministic direct-SQL variant. |
