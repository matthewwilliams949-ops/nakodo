// All product email is plain text: on-brand (no performance) and better
// deliverability from a fresh domain.

const PRODUCT = 'Nakodo'

export function welcome(): { subject: string; text: string } {
  return {
    subject: `You're in — this is where we knock when your person shows up`,
    text: [
      `Your profile is on record. Nothing about you is ever displayed to anyone — profiles and snippets are only compared, never published.`,
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

// v1.1: the reveal email carries no identity and no contact details — those
// are exchanged by the two people themselves, on the intro page.
export function revealNotice(introUrl: string): { subject: string; text: string } {
  return {
    subject: `You both said yes`,
    text: [
      `You both accepted the introduction. Pick it up here:`,
      ``,
      `  ${introUrl}`,
      ``,
      `That page is where you two connect: leave whatever contact details you're comfortable with, and see what they leave for you. Nothing is exchanged on your behalf.`,
      ``,
      `— ${PRODUCT}`,
    ].join('\n'),
  }
}
