// Concierge tool: create an intro and email both anonymous cards.
// Usage: pnpm intro:send path/to/intro.json
//   { "userAEmail": "...", "userBEmail": "...",
//     "cardA": "card shown TO A describing B", "cardB": "card shown TO B describing A" }
import { readFileSync } from 'node:fs'
import { createIntro } from '../lib/intros'

const path = process.argv[2]
if (!path) {
  console.error('Usage: pnpm intro:send path/to/intro.json (see header of this file for the shape)')
  process.exit(1)
}

const input = JSON.parse(readFileSync(path, 'utf8'))
for (const key of ['userAEmail', 'userBEmail', 'cardA', 'cardB']) {
  if (typeof input[key] !== 'string' || input[key].length === 0) {
    console.error(`Missing or empty field: ${key}`)
    process.exit(1)
  }
}

const { id } = await createIntro(input)
console.log(`Intro ${id} created; both card emails sent.`)
process.exit(0)
