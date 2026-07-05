// Sends a test email via Resend to verify domain DNS + API key (SETUP-ACCOUNTS.md step 7).
import { Resend } from 'resend'

const key = process.env.RESEND_API_KEY
const from = process.env.EMAIL_FROM
const to = process.argv[2] ?? 'matthew.williams949@gmail.com'
if (!key || !from) {
  console.error('RESEND_API_KEY and EMAIL_FROM must be set in .env (SETUP-ACCOUNTS.md step 6).')
  process.exit(1)
}

const resend = new Resend(key)
const { data, error } = await resend.emails.send({
  from,
  to,
  subject: 'Smoke test — sender domain is live',
  text: 'If this landed in your inbox (not spam), the Resend domain setup is done.',
})
if (error) {
  console.error('Send failed:', error)
  process.exit(1)
}
console.log(`Sent to ${to} (id ${data?.id}). Check that it landed in the inbox, not spam.`)
