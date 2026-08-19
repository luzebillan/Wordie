import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type { Database as BetterSqlite3Database } from 'better-sqlite3'

let cachedSettings: Record<string, string> = {}
let isInitialized = false

function getConfigPath(): string {
  // In packaged or dev Electron app
  const userData = app?.getPath ? app.getPath('userData') : path.join(process.cwd(), '.userData')
  return path.join(userData, 'config.json')
}

/**
 * Initialize settings:
 * 1. If config.json exists, load it into cache.
 * 2. If config.json does NOT exist, check if legacy SQLite has a `settings` table to migrate.
 * 3. Otherwise initialize with empty or defaults and save to config.json.
 */
export function initSettings(db?: BetterSqlite3Database): Record<string, string> {
  const configPath = getConfigPath()
  
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8')
      cachedSettings = JSON.parse(content || '{}')
      isInitialized = true
      return cachedSettings
    }
  } catch (err) {
    console.error('[Config] Error reading existing config.json, will attempt recovery:', err)
  }

  // Attempt migration from legacy SQLite `settings` table if available
  let migratedSettings: Record<string, string> = {}
  if (db) {
    try {
      const hasSettingsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'").get()
      if (hasSettingsTable) {
        const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string, value: string }[]
        rows.forEach(row => {
          // Do not migrate DB-internal metadata if present
          if (row.key !== 'semantic_model_version') {
            migratedSettings[row.key] = row.value
          }
        })
        if (Object.keys(migratedSettings).length > 0) {
          console.log('[Config] Successfully migrated legacy settings from SQLite to config.json')
        }
      }
    } catch (dbErr) {
      console.warn('[Config] Failed to check or migrate legacy SQLite settings:', dbErr)
    }
  }

  cachedSettings = { ...migratedSettings }
  isInitialized = true
  saveSettingsToDisk(cachedSettings)
  return cachedSettings
}

/**
 * Synchronously retrieves all settings from in-memory cache.
 */
export function getSettings(): Record<string, string> {
  if (!isInitialized) {
    initSettings()
  }
  return { ...cachedSettings }
}

/**
 * Retrieves a single setting by key.
 */
export function getSetting(key: string): string | undefined {
  if (!isInitialized) {
    initSettings()
  }
  return cachedSettings[key]
}

/**
 * Saves partial or full settings, updates memory cache, and performs atomic write to disk.
 */
export function saveSettings(partialSettings: Record<string, string>): { success: boolean, error?: string } {
  if (!isInitialized) {
    initSettings()
  }

  for (const [key, value] of Object.entries(partialSettings)) {
    cachedSettings[key] = String(value)
  }

  const success = saveSettingsToDisk(cachedSettings)
  return { success }
}

/**
 * Atomic write to disk using a temporary file.
 */
function saveSettingsToDisk(settings: Record<string, string>): boolean {
  const configPath = getConfigPath()
  const tempPath = `${configPath}.tmp`
  
  try {
    const dir = path.dirname(configPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(tempPath, JSON.stringify(settings, null, 2), 'utf-8')
    fs.renameSync(tempPath, configPath)
    return true
  } catch (err: any) {
    console.error('[Config] Failed to write config.json:', err)
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath)
      }
    } catch {}
    return false
  }
}
