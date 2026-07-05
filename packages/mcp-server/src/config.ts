import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const ENV_PREFIX = 'NAKODO'
const DIR_NAME = 'nakodo'
const DEFAULT_API_URL = 'https://nakodo.dev'

export interface Config {
  install_id: string
  email?: string
  token?: string
}

function configDir(): string {
  return (
    process.env[`${ENV_PREFIX}_CONFIG_DIR`] ??
    join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), DIR_NAME)
  )
}

function configFile(): string {
  return join(configDir(), 'config.json')
}

export function loadConfig(): Config {
  const file = configFile()
  if (existsSync(file)) {
    try {
      return JSON.parse(readFileSync(file, 'utf8')) as Config
    } catch {
      // corrupt config: fall through and regenerate
    }
  }
  const fresh: Config = { install_id: randomUUID() }
  saveConfig(fresh)
  return fresh
}

export function saveConfig(config: Config): void {
  mkdirSync(configDir(), { recursive: true })
  writeFileSync(configFile(), JSON.stringify(config, null, 2) + '\n')
}

// delete_me wipes everything, install_id included — a fresh start is a fresh id.
export function wipeConfig(): void {
  rmSync(configDir(), { recursive: true, force: true })
}

export function apiUrl(): string {
  return process.env[`${ENV_PREFIX}_API_URL`] ?? DEFAULT_API_URL
}
