// Protocol-level integration tests (BUILD-PLAN M3 done-condition): the real
// server is spawned as a child process over stdio, exactly as an MCP client
// runs it; a mock backend receives its HTTP calls.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js'
import { startMockApi, type MockApi } from './mock-api.js'

const PKG_ROOT = join(import.meta.dirname, '..')

let api: MockApi
let client: Client
let configDir: string

async function callText(name: string, args: Record<string, unknown> = {}): Promise<string> {
  const res = await client.callTool({ name, arguments: args })
  const content = res.content as { type: string; text?: string }[]
  return content.map((c) => c.text ?? '').join('\n')
}

beforeAll(async () => {
  api = await startMockApi()
  configDir = mkdtempSync(join(tmpdir(), 'mcp-test-config-'))

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', join(PKG_ROOT, 'src', 'index.ts')],
    cwd: PKG_ROOT,
    env: {
      ...getDefaultEnvironment(),
      NAKODO_CONFIG_DIR: configDir,
      NAKODO_API_URL: api.url,
    },
  })
  client = new Client({ name: 'test-client', version: '0.0.0' })
  await client.connect(transport)
})

afterAll(async () => {
  await client?.close()
  await api?.close()
  rmSync(configDir, { recursive: true, force: true })
})

describe('nakodo over stdio', () => {
  it('exposes exactly the v1 tools', async () => {
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name).sort()).toEqual([
      'capture_snippet',
      'create_profile',
      'delete_me',
      'find_collaborator',
      'my_record',
    ])
    // Motion 3 surface: the front door advertises the real phrasings
    const frontDoor = tools.find((t) => t.name === 'find_collaborator')!
    for (const phrase of ['co-founder', 'design', 'marketing', 'building something similar']) {
      expect(frontDoor.description).toContain(phrase)
    }
  })

  it('find_collaborator without a profile returns onboarding steps and logs the event', async () => {
    const out = await callText('find_collaborator', { need: 'design help for my onboarding flow' })
    expect(out).toContain('onboarding')
    expect(out).toContain('create_profile')
    expect(out).toContain('How did you find this tool?')
    expect(out).toContain('design help for my onboarding flow')
    expect(api.state.events.some((e) => e.type === 'client_front_door_unregistered' || e.type === 'front_door_unregistered')).toBe(true)
  })

  it('capture_snippet before registration points back to the front door', async () => {
    const out = await callText('capture_snippet', { snippet: 'built a thing' })
    expect(out).toContain('find_collaborator')
    expect(api.state.snippets).toHaveLength(0)
  })

  it('create_profile registers, stores the token, and saves the profile', async () => {
    const out = await callText('create_profile', {
      email: 'matthew@example.com',
      profile: 'Building an agent-networking MCP server. Strong at TypeScript.',
      source: 'agent registry search',
      handle: 'mw',
      location: 'Berlin',
    })
    expect(out.toLowerCase()).toContain('on record')
    expect(api.state.registered).toMatchObject({ email: 'matthew@example.com', source: 'agent registry search' })
    expect(api.state.registered!.install_id).toBeTruthy()
    expect(api.state.profile).toContain('agent-networking')
  })

  it('find_collaborator with a profile registers a standing ask', async () => {
    const out = await callText('find_collaborator', { need: 'someone strong at product design' })
    expect(out).toContain('standing ask')
    expect(api.state.asks).toContain('someone strong at product design')
  })

  it('capture_snippet posts the approved snippet', async () => {
    const out = await callText('capture_snippet', { snippet: 'Shipped the intro email flow with double opt-in.' })
    expect(out).toContain('On record')
    expect(api.state.snippets).toContain('Shipped the intro email flow with double opt-in.')
  })

  it('my_record shows profile, asks, and snippets — nothing about others', async () => {
    const out = await callText('my_record')
    expect(out).toContain('matthew@example.com')
    expect(out).toContain('agent-networking')
    expect(out).toContain('someone strong at product design')
    expect(out).toContain('Shipped the intro email flow')
  })

  it('a waiting intro is announced in-session (v1.1 channel)', async () => {
    api.state.pendingIntros = [{ url: 'http://x/intro/tok-pending-1', created_at: '2026-07-09T00:00:00Z' }]
    const out = await callText('my_record')
    expect(out).toContain('introduction is waiting')
    expect(out).toContain('http://x/intro/tok-pending-1')
    api.state.pendingIntros = []
    const quiet = await callText('my_record')
    expect(quiet).not.toContain('introduction is waiting')
  })

  it('delete_me without confirmation does not delete', async () => {
    const out = await callText('delete_me', { confirm: false })
    expect(out).toContain('Not deleted')
    expect(api.state.deleted).toBe(false)
  })

  it('delete_me with confirmation deletes remotely and wipes local state', async () => {
    const out = await callText('delete_me', { confirm: true })
    expect(out).toContain('permanently deleted')
    expect(api.state.deleted).toBe(true)
    // back to unregistered behavior
    const after = await callText('my_record')
    expect(after).toContain('no profile')
  })
})
