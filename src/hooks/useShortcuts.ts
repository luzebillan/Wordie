import { useState, useEffect, useCallback } from 'react'
import { DEFAULT_SHORTCUTS, matchesShortcut, formatShortcutDisplay } from '../utils/shortcuts'

export function useShortcuts() {
  const [shortcuts, setShortcuts] = useState<Record<string, string>>(DEFAULT_SHORTCUTS)

  const loadShortcuts = useCallback(async () => {
    try {
      const settings = await window.ipcRenderer.getSettings()
      if (settings.customShortcuts) {
        try {
          const parsed = JSON.parse(settings.customShortcuts)
          setShortcuts({ ...DEFAULT_SHORTCUTS, ...parsed })
          return
        } catch (e) {
          console.error('Failed to parse customShortcuts setting:', e)
        }
      }
      setShortcuts(DEFAULT_SHORTCUTS)
    } catch (err) {
      console.error('Failed to load settings in useShortcuts:', err)
    }
  }, [])

  useEffect(() => {
    loadShortcuts()

    const handleSettingsUpdated = () => {
      loadShortcuts()
    }

    window.addEventListener('settings-updated', handleSettingsUpdated)
    return () => {
      window.removeEventListener('settings-updated', handleSettingsUpdated)
    }
  }, [loadShortcuts])

  const isActionPressed = useCallback((actionId: string, e: KeyboardEvent): boolean => {
    const combo = shortcuts[actionId] || DEFAULT_SHORTCUTS[actionId]
    return matchesShortcut(e, combo)
  }, [shortcuts])

  const getShortcutDisplay = useCallback((actionId: string): string => {
    const combo = shortcuts[actionId] || DEFAULT_SHORTCUTS[actionId]
    return formatShortcutDisplay(combo)
  }, [shortcuts])

  const updateShortcut = useCallback(async (actionId: string, newCombo: string) => {
    const updated = { ...shortcuts, [actionId]: newCombo }
    setShortcuts(updated)
    await window.ipcRenderer.saveSettings({ customShortcuts: JSON.stringify(updated) })
    window.dispatchEvent(new Event('settings-updated'))
  }, [shortcuts])

  const resetShortcut = useCallback(async (actionId: string) => {
    const updated = { ...shortcuts, [actionId]: DEFAULT_SHORTCUTS[actionId] }
    setShortcuts(updated)
    await window.ipcRenderer.saveSettings({ customShortcuts: JSON.stringify(updated) })
    window.dispatchEvent(new Event('settings-updated'))
  }, [shortcuts])

  const resetAllShortcuts = useCallback(async () => {
    setShortcuts(DEFAULT_SHORTCUTS)
    await window.ipcRenderer.saveSettings({ customShortcuts: JSON.stringify(DEFAULT_SHORTCUTS) })
    window.dispatchEvent(new Event('settings-updated'))
  }, [])

  return {
    shortcuts,
    isActionPressed,
    getShortcutDisplay,
    updateShortcut,
    resetShortcut,
    resetAllShortcuts
  }
}
