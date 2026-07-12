import { randomUUID } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
      // heal pre-0.2.3 installs that wrote the token file world-readable
      chmodSync(configDir(), 0o700)
      chmodSync(file, 0o600)
    } catch {
      // best-effort on platforms without POSIX modes (Windows)
    }
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

// Owner-only permissions (0.2.3 audit): the file holds the bearer token — the
// credential for the user's whole record. mode on writeFileSync applies only
// at creation, so chmod explicitly to also heal pre-0.2.3 installs in place.
export function saveConfig(config: Config): void {
  mkdirSync(configDir(), { recursive: true, mode: 0o700 })
  writeFileSync(configFile(), JSON.stringify(config, null, 2) + '\n', { mode: 0o600 })
  try {
    chmodSync(configDir(), 0o700)
    chmodSync(configFile(), 0o600)
  } catch {
    // best-effort on platforms without POSIX modes (Windows)
  }
}

// delete_me wipes everything, install_id included — a fresh start is a fresh id.
export function wipeConfig(): void {
  rmSync(configDir(), { recursive: true, force: true })
}

export function apiUrl(): string {
  return process.env[`${ENV_PREFIX}_API_URL`] ?? DEFAULT_API_URL
}
