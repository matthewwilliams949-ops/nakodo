// All product email is plain text: on-brand (no performance) and better
// deliverability from a fresh domain.

const PRODUCT = 'Nakodo'

export function welcome(): { subject: string; text: string } {
  return {
    subject: `You're in — this is where we knock when your person shows up`,
    text: [
      `Your profile is on record — and it carries no identity: no name, no links, nothing that points back to you. Agents match on the work, not the person; your name and contact live separately and surface only when you both say yes.`,
      ``,
      `From here, silence is normal. The only email you'll ever get from us is a knock: an anonymous card describing someone worth meeting, with a private page to accept or decline. If you both say yes, that page is where you two connect — we never pass your contact details to anyone. If either of you passes, the other never knows.`,
      ``,
      `— ${PRODUCT}`,
    ].join('\n'),
  }
}

// A single link, not an Accept/Decline pair: the labels implied one-click
// actions the links don't perform, and invited a decision before the card was
// even read. One link to the page, which is where the card and the buttons are.
export function introCard(card: string, url: string): { subject: string; text: string } {
  return {
    subject: `An introduction is waiting for you`,
    text: [
      `We think we found your person. Here's what we can say without revealing them:`,
      ``,
      `  ${card}`,
      ``,
      `See the card and decide:  ${url}`,
      ``,
      `They see nothing unless you both say yes — and if you pass, they'll never know this card existed.`,
      ``,
      `— ${PRODUCT}`,
    ].join('\n'),
  }
}

// The reveal email carries no identity and no contact details (email is an
// unauthenticated, forwardable surface — names and content live on the page).
// M8 item d: the subject carries the ACTION ("go say hello"), not just the news.
export function revealNotice(introUrl: string): { subject: string; text: string } {
  return {
    subject: `You both said yes — go say hello`,
    text: [
      `You both accepted the introduction. It's open now — their name is on the page, and the first hello is waiting to be written:`,
      ``,
      `  ${introUrl}`,
      ``,
      `That page is a private thread between the two of you. Whatever contact details you share there, you share yourself — nothing is ever sent on your behalf.`,
      ``,
      `— ${PRODUCT}`,
    ].join('\n'),
  }
}

// M8 item c: fired only when the ball crosses into the recipient's court — a
// reply arrives and their own message was the previous latest (send rule in
// lib/intros.ts). Identity-free like every other email: the message body lives
// on the page, never in the mail.
export function messageWaiting(introUrl: string): { subject: string; text: string } {
  return {
    subject: `A message is waiting on your introduction`,
    text: [
      `Someone you said yes to has written to you. Pick it up here:`,
      ``,
      `  ${introUrl}`,
      ``,
      `— ${PRODUCT}`,
    ].join('\n'),
  }
}
