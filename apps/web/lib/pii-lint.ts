// M8 PII lint: the seatbelt behind the drafting guidance (guarantee 2 — the
// pool carries nothing identifying). Profile and snippet writes are REJECTED
// when a flag fires; the agent redrafts. Imperfect by design: the agent
// instruction is the first line of defense, this catches the obvious leaks.
//
// Flag vocabulary is shared with the MCP drafting guidance (A2) and the
// propose endpoint contract (documentation/api-contract-m8.md): keep the
// names stable — 'email' | 'url' | 'handle' | 'phone' | 'instruction'.

export type PiiFlag = 'email' | 'url' | 'handle' | 'phone' | 'instruction'

export interface PiiFinding {
  flag: PiiFlag
  excerpt: string // the offending substring, echoed back so the agent can redraft
}

// Obfuscation-normalization: "name (at) gmail (dot) com" → "name@gmail.com"
// before the email/url scans. Only common spellings — this is a seatbelt.
function deobfuscate(text: string): string {
  return text
    .replace(/\s*[([{]?\s*(at|@)\s*[)\]}]?\s*/gi, (m) => (/at|@/i.test(m) && /[([{\s]/.test(m) ? '@' : m))
    .replace(/\s*[([{]\s*dot\s*[)\]}]\s*/gi, '.')
    .replace(/\s+dot\s+/gi, '.')
}

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi

// URLs with protocol, www-prefixed, or bare domains on common TLDs. The TLD
// list is deliberately short: catching real links matters more than catching
// every ccTLD, and prose like "Next.js" must not flag.
const URL = /(https?:\/\/\S+|www\.\S+|\b[a-z0-9][a-z0-9-]*\.(com|dev|io|ai|app|net|org|co|me|xyz|sh|gg)(\/\S*)?\b)/gi

// @handles in prose (start-of-string or after whitespace/bracket so emails,
// already flagged above, don't double-report weirdly).
const HANDLE = /(?:^|[\s([{"'])(@[a-z0-9_.-]{2,30})\b/gim

// Phone candidates: digit runs with common separators; confirmed only when
// the candidate carries ≥ 9 digits, so years, versions, and counts pass.
const PHONE_CANDIDATE = /\+?\d[\d\s().\-/]{6,}\d/g

// Instruction-shaped text: pool content flows into strangers' agent contexts,
// so anything that reads as an instruction to an agent is rejected outright.
// Conservative list — obvious injections only; prose about one's work passes.
const INSTRUCTION = new RegExp(
  [
    /ignore\s+(all\s+|any\s+|the\s+)?(previous|above|prior|earlier)\s+(instructions?|messages?|rules?|context)/.source,
    /disregard\s+(all\s+|the\s+)?(above|previous|prior|earlier)/.source,
    /you\s+are\s+now\s+/.source,
    /new\s+(system\s+)?instructions?\s*:/.source,
    /\bsystem\s*prompt\b/.source,
    /<\/?\s*(system|assistant|instructions?)\s*>/.source,
    /\b(assistant|system)\s*:\s/.source,
    /do\s+not\s+(tell|show|reveal\s+to)\s+(the\s+)?(user|human)/.source,
    /\bIMPORTANT\s*:\s*(you|agent|assistant)\b/.source,
  ].join('|'),
  'gi',
)

function findAll(text: string, flag: PiiFlag, re: RegExp, group = 0): PiiFinding[] {
  const out: PiiFinding[] = []
  for (const m of text.matchAll(re)) {
    const hit = m[group] ?? m[0]
    out.push({ flag, excerpt: hit.trim().slice(0, 80) })
  }
  return out
}

export function lintPII(text: string): { clean: boolean; findings: PiiFinding[]; flags: PiiFlag[] } {
  const normalized = deobfuscate(text)
  const findings: PiiFinding[] = [
    ...findAll(normalized, 'email', EMAIL),
    ...findAll(normalized, 'url', URL),
    ...findAll(text, 'handle', HANDLE, 1),
    ...findAll(text, 'phone', PHONE_CANDIDATE).filter(
      (f) => f.excerpt.replace(/\D/g, '').length >= 9,
    ),
    ...findAll(text, 'instruction', INSTRUCTION),
  ]
  const flags = [...new Set(findings.map((f) => f.flag))]
  return { clean: findings.length === 0, findings, flags }
}

// Route helper: the standard 422 for pool-bound writes (profiles, snippets,
// propose whys). Echoes findings so the agent can redraft precisely.
export function piiRejection(findings: PiiFinding[], flags: PiiFlag[]): Response {
  return Response.json(
    {
      error: 'pii_detected',
      flags,
      findings,
      hint:
        'This text enters the anonymous pool, so it must carry nothing identifying and no instruction-shaped content. Redraft without the flagged parts — describe the work, not the person.',
    },
    { status: 422 },
  )
}
