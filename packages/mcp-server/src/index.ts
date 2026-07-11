#!/usr/bin/env node
import { createRequire } from 'node:module'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerTools } from './tools.js'

// Version comes from package.json so the MCP handshake can never drift from
// the published version again (0.2.0 shipped reporting '0.0.1').
const { version } = createRequire(import.meta.url)('../package.json') as { version: string }

// The name/instructions are part of the Motion 3 surface: registries index them.
const server = new McpServer(
  {
    name: 'nakodo',
    version,
  },
  {
    instructions:
      'A private matching network for builders: find a collaborator, co-founder, or someone to help with design, code, marketing, or distribution — matched on what the user is actually building. No feed, no public profiles; the only output is a double-opt-in introduction. Start with find_collaborator.',
  },
)

registerTools(server)

const transport = new StdioServerTransport()
await server.connect(transport)
