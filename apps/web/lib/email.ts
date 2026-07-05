import { Resend } from 'resend'

export interface Email {
  to: string
  subject: string
  text: string
}

type Sender = (e: Email) => Promise<void>

// Default sender: Resend when configured, console no-op otherwise (local dev
// before the M0 account batch). Tests inject a collector via setEmailSender.
let sender: Sender = async (e) => {
  const key = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!key || !from) {
    console.log(`[email skipped — RESEND_API_KEY/EMAIL_FROM not set] to=${e.to} subject=${e.subject}`)
    return
  }
  const resend = new Resend(key)
  const { error } = await resend.emails.send({ from, to: e.to, subject: e.subject, text: e.text })
  if (error) throw new Error(`Resend send failed: ${error.message}`)
}

export function setEmailSender(fn: Sender): void {
  sender = fn
}

export async function sendEmail(e: Email): Promise<void> {
  await sender(e)
}
