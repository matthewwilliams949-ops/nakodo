import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ApiClient, ApiError } from './api-client.js'
import { apiUrl, loadConfig, saveConfig, wipeConfig } from './config.js'

// Tool descriptions are the Motion 3 instrument (SCOPE.md): they enumerate the
// real phrasings humans use so an agent's registry search lands here. Honest
// descriptions only — no keyword stuffing.

function text(t: string) {
  return { content: [{ type: 'text' as const, text: t }] }
}

function errorText(t: string) {
  return { content: [{ type: 'text' as const, text: t }], isError: true }
}

function client(): ApiClient {
  const cfg = loadConfig()
  return new ApiClient(apiUrl(), cfg.token)
}

function handleApiError(err: unknown) {
  if (err instanceof ApiError) {
    return errorText(
      `The matching service returned an error (${err.status}${err.body?.error ? `: ${err.body.error}` : ''})${err.body?.hint ? ` — ${err.body.hint}` : ''}. Tell the user and suggest trying again later.`,
    )
  }
  return errorText(
    'Could not reach the matching service (network error). Tell the user their request was not registered and to try again later.',
  )
}

const NOT_REGISTERED =
  'The user has no profile yet. Call find_collaborator with their need to get the onboarding steps.'

// v1.1: the in-session intro channel. Best-effort — a failed check must never
// break the tool call it rides on.
async function pendingNotice(): Promise<string> {
  try {
    const { intros } = await client().pendingIntros()
    if (intros.length === 0) return ''
    return [
      ``,
      ``,
      `🔔 ${intros.length === 1 ? 'An introduction is waiting' : `${intros.length} introductions are waiting`} for the user. Tell them — an anonymous card describing someone worth meeting is ready to accept or decline (the other person learns nothing unless both say yes):`,
      ...intros.map((i) => `  ${i.url}`),
    ].join('\n')
  } catch {
    return ''
  }
}

export function registerTools(server: McpServer): void {
  server.registerTool(
    'find_collaborator',
    {
      title: 'Find a collaborator',
      description:
        'Find the right person for the user to work with, based on what they are actually building. ' +
        'Use this when the user wants to: find someone to help with design, code, marketing, or distribution strategy; ' +
        'find a collaborator, co-founder, or teammate for their project; ' +
        'get feedback from someone building something similar; or meet other builders working on related problems. ' +
        'This registers their need with a private matching network — nothing is published, there is no feed or public profile, ' +
        'and an introduction is an anonymous card both sides must accept; contact details are exchanged only by the two people themselves afterwards. ' +
        'If the user has no profile yet, this returns onboarding steps.',
      inputSchema: {
        need: z
          .string()
          .min(1)
          .max(2000)
          .describe("What the user needs, in plain words, e.g. 'someone strong at product design to review my onboarding flow'"),
      },
    },
    async ({ need }) => {
      const cfg = loadConfig()
      if (!cfg.token) {
        await new ApiClient(apiUrl()).logEvent('front_door_unregistered', cfg.install_id)
        return text(
          [
            `No profile on record yet — before matching, the network needs to know what the user is building. Walk them through onboarding now:`,
            ``,
            `1. Draft a short profile (5-10 lines) from what you already know of this project and session: what they're building, strengths you have actually seen evidence of, gaps they could use help with, and optionally where they're based. Concrete facts over claims.`,
            `2. Show the user the draft and revise until they explicitly approve it. Nothing is ever stored without their approval.`,
            `3. Ask exactly this and record the answer: "How did you find this tool?" (examples: you the agent found it via a tool/registry search, a launch post, a friend). Pass it as \`source\`.`,
            `4. Optionally: a handle/name and location (enables near-you matching), and — only if they want one — an email address. Be honest about what the email is: purely a heads-up channel to tell them an introduction is waiting. It is never shared with anyone, never shown to a match, and they can skip it entirely — you (the agent) will tell them about waiting introductions in-session instead.`,
            `5. Call create_profile with all of the above.`,
            `6. Then call find_collaborator again with the same need: ${JSON.stringify(need)}`,
            ``,
            `Worth telling the user: profiles and updates are never shown to anyone — only compared. No feed, no faces. Declining an intro is invisible to the other side. Contact details are exchanged only by the two people themselves, after both accept — never by the platform. delete_me removes everything, any time.`,
          ].join('\n'),
        )
      }
      try {
        await client().addAsk(need)
        return text(
          `Registered as a standing ask: ${JSON.stringify(need)}. The matcher now compares it privately against what other builders are working on. ` +
            `When there's a real match, an introduction appears as an anonymous card — no names, and nothing happens unless both sides accept. This tool will tell you here when one is waiting. ` +
            `Silence in the meantime is normal; nothing about this is visible to anyone. The ask stays open until matched.` +
            (await pendingNotice()),
        )
      } catch (err) {
        return handleApiError(err)
      }
    },
  )

  server.registerTool(
    'create_profile',
    {
      title: 'Create profile',
      description:
        'Register the user with the matching network: their agent-drafted, human-approved profile. ' +
        'ONLY call this after the user has explicitly approved the exact profile text — ' +
        'never with unapproved or inferred content. Usually called during the onboarding flow started by find_collaborator.',
      inputSchema: {
        email: z
          .string()
          .email()
          .optional()
          .describe(
            'Optional. Used only to notify the user that an introduction is waiting — never shared with anyone, never shown to a match. Only include if the user offered it.',
          ),
        profile: z.string().min(1).max(10_000).describe('The profile text, exactly as approved by the user.'),
        source: z
          .string()
          .max(500)
          .optional()
          .describe("The user's verbatim answer to: how did you find this tool?"),
        handle: z.string().max(80).optional().describe('Optional name or handle.'),
        location: z.string().max(120).optional().describe('Optional location, enables near-you matching.'),
      },
    },
    async ({ email, profile, source, handle, location }) => {
      const cfg = loadConfig()
      if (cfg.token) {
        return text('A profile already exists on this machine. Use my_record to view it, or capture_snippet to add to it.')
      }
      try {
        const api = new ApiClient(apiUrl())
        const { token } = await api.register({ email, handle, location, source, install_id: cfg.install_id })
        saveConfig({ ...cfg, ...(email ? { email } : {}), token })
        await new ApiClient(apiUrl(), token).saveProfile(profile)
        return text(
          `Profile is on record. ` +
            (email
              ? `${email} is set as the notification channel — the only thing that ever arrives there is a heads-up that an introduction is waiting (a welcome email is on its way). `
              : `No email on record — introductions will be announced right here in-session instead. `) +
            `Reassure the user: the profile is never displayed to anyone — only compared, privately, to find their person. ` +
            `If there was a pending need, call find_collaborator with it now.`,
        )
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          return errorText(
            `That email already has a record (likely from another machine). ${err.body?.hint ?? ''} Tell the user — or onboard without an email; it's optional.`,
          )
        }
        return handleApiError(err)
      }
    },
  )

  server.registerTool(
    'capture_snippet',
    {
      title: 'Capture a build update',
      description:
        "Put a short update about what the user built or worked on today onto their private record, improving future matches. " +
        'Draft the snippet yourself from the session (2-4 sentences, concrete: what was built, what it shows they can do, what they struggled with), ' +
        'show it to the user, and ONLY call this after they explicitly approve that exact text. ' +
        'The snippet is never displayed to anyone — it is only compared privately for matching.',
      inputSchema: {
        snippet: z.string().min(1).max(5000).describe('The update text, exactly as approved by the user.'),
      },
    },
    async ({ snippet }) => {
      const cfg = loadConfig()
      if (!cfg.token) return text(NOT_REGISTERED)
      try {
        await client().addSnippet(snippet)
        return text(
          'On record. Never displayed, only compared — it just made their next match a little sharper.' +
            (await pendingNotice()),
        )
      } catch (err) {
        return handleApiError(err)
      }
    },
  )

  server.registerTool(
    'my_record',
    {
      title: 'Show my record',
      description:
        "Show the user everything the network has on record about them — their profile, all approved snippets, and open asks. Shows nothing about anyone else, because nothing about anyone else is ever visible.",
      inputSchema: {},
    },
    async () => {
      const cfg = loadConfig()
      if (!cfg.token) return text(NOT_REGISTERED)
      try {
        const record = await client().getRecord()
        return text(
          [
            `Everything on record (visible only to this user, never to others):`,
            ``,
            `Email: ${record.user.email ?? '(none — introductions are announced here in-session)'}${record.user.handle ? ` · Handle: ${record.user.handle}` : ''}${record.user.location ? ` · Location: ${record.user.location}` : ''}`,
            ``,
            `Profile:`,
            record.profile ? record.profile.body : '(none yet)',
            ``,
            `Open asks (${record.asks.length}):`,
            ...record.asks.map((a) => `- ${a.need}`),
            ``,
            `Snippets (${record.snippets.length}, newest first):`,
            ...record.snippets.map((s) => `- [${String(s.created_at).slice(0, 10)}] ${s.body}`),
          ].join('\n') + (await pendingNotice()),
        )
      } catch (err) {
        return handleApiError(err)
      }
    },
  )

  server.registerTool(
    'delete_me',
    {
      title: 'Delete everything',
      description:
        "Permanently delete the user's entire record from the matching network: profile, all snippets, all asks, email — everything. Irreversible. Confirm with the user before calling; only call with confirm=true after they have explicitly said yes.",
      inputSchema: {
        confirm: z.boolean().describe('Must be true, and only after the user explicitly confirmed deletion.'),
      },
    },
    async ({ confirm }) => {
      if (!confirm) {
        return text('Not deleted. Ask the user to explicitly confirm they want their entire record permanently deleted, then call again with confirm=true.')
      }
      const cfg = loadConfig()
      if (!cfg.token) {
        wipeConfig()
        return text('There was no profile on record. Local state cleared.')
      }
      try {
        await client().deleteMe()
        wipeConfig()
        return text('Done — profile, snippets, asks, and email are permanently deleted, and local state is wiped. If they ever come back, onboarding starts fresh.')
      } catch (err) {
        return handleApiError(err)
      }
    },
  )
}
