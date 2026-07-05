#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerTools } from './tools.js'

// PLACEHOLDER server name/description — rename pass updates alongside npm name.
// The description is part of the Motion 3 surface: it's what registries index.
const server = new McpServer(
  {
    name: 'agent-networker',
    version: '0.0.1',
  },
  {
    instructions:
      'A private matching network for builders: find a collaborator, co-founder, or someone to help with design, code, marketing, or distribution — matched on what the user is actually building. No feed, no public profiles; the only output is a double-opt-in introduction by email. Start with find_collaborator.',
  },
)

registerTools(server)

const transport = new StdioServerTransport()
await server.connect(transport)
