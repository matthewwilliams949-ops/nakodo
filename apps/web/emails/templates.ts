// All product email is plain text: on-brand (no performance) and better
// deliverability from a fresh domain.

const PRODUCT = 'Nakodo'

export function welcome(): { subject: string; text: string } {
  return {
    subject: `You're in — this is where your person shows up`,
    text: [
      `Your profile is on record. Nothing about you is ever displayed to anyone — profiles and snippets are only compared, never published.`,
      ``,
      `From here, silence is normal. The only email you'll ever get from us is an introduction: an anonymous card describing someone worth meeting. If you both say yes, we connect you. If either of you passes, the other never knows.`,
      ``,
      `— ${PRODUCT}`,
    ].join('\n'),
  }
}

export function introCard(card: string, acceptUrl: string, declineUrl: string): { subject: string; text: string } {
  return {
    subject: `An introduction is waiting for you`,
    text: [
      `We think we found your person. Here's what we can say without revealing them:`,
      ``,
      `  ${card}`,
      ``,
      `If you want the introduction, accept below. They see nothing unless you both say yes — and if you pass, they'll never know this card existed.`,
      ``,
      `Accept:  ${acceptUrl}`,
      `Decline: ${declineUrl}`,
      ``,
      `— ${PRODUCT}`,
    ].join('\n'),
  }
}

export function reveal(counterpartName: string, counterpartEmail: string, card: string): { subject: string; text: string } {
  return {
    subject: `You both said yes — meet ${counterpartName}`,
    text: [
      `You both accepted. The person behind the card —`,
      ``,
      `  ${card}`,
      ``,
      `— is ${counterpartName} (${counterpartEmail}). They got this same email about you, so a reply won't come out of nowhere. Just write them; shortest email wins.`,
      ``,
      `— ${PRODUCT}`,
    ].join('\n'),
  }
}
