export interface ShortcutDefinition {
  id: string
  category: 'revision' | 'card' | 'navigation' | 'practice'
  name: string
  description: string
  defaultKey: string
}

export const SHORTCUT_CATEGORIES = [
  { id: 'revision', name: 'Revision' },
  { id: 'card', name: 'Card Creation & Edit' },
  { id: 'practice', name: 'Practice' },
  { id: 'navigation', name: 'Navigation & Global' },
] as const

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  // Revision
  {
    id: 'revision.flip',
    category: 'revision',
    name: 'Show Answer / Got it',
    description: 'Flip card to show answer, or mark as known if answer is already shown',
    defaultKey: 'Space'
  },
  {
    id: 'revision.forget',
    category: 'revision',
    name: 'Mark as Forgotten',
    description: 'Mark the current card as forgotten (restart interval)',
    defaultKey: 'F'
  },
  {
    id: 'revision.edit',
    category: 'revision',
    name: 'Edit Card',
    description: 'Enter inline editing mode for the current review card',
    defaultKey: 'E'
  },
  {
    id: 'revision.save',
    category: 'revision',
    name: 'Save Edit',
    description: 'Save changes made in card editing mode',
    defaultKey: 'Ctrl+S'
  },
  {
    id: 'revision.undo',
    category: 'revision',
    name: 'Undo Review',
    description: 'Undo the last review action in the current session',
    defaultKey: 'Ctrl+Z'
  },
  {
    id: 'revision.shuffle',
    category: 'revision',
    name: 'Shuffle Remaining Cards',
    description: 'Shuffle remaining review cards in the current session',
    defaultKey: 'Ctrl+Tab'
  },
  {
    id: 'revision.cancel',
    category: 'revision',
    name: 'Cancel Edit',
    description: 'Cancel card editing without saving changes',
    defaultKey: 'Escape'
  },

  // Card Creation & Editing
  {
    id: 'card.submit',
    category: 'card',
    name: 'AI Generate / Save Card',
    description: 'Trigger AI definition generation or save card in forms',
    defaultKey: 'Ctrl+Enter'
  },
  {
    id: 'card.clear',
    category: 'card',
    name: 'Clear Form Inputs',
    description: 'Clear all input fields in the current card form',
    defaultKey: 'Ctrl+Q'
  },
  {
    id: 'practice.clear',
    category: 'practice',
    name: 'Clear Practice Inputs & Results',
    description: 'Clear original input and AI-generated results in Practice tabs',
    defaultKey: 'Ctrl+Q'
  },
  {
    id: 'card.new',
    category: 'card',
    name: 'Quick New Card',
    description: 'Open quick card creation popup from anywhere in practice',
    defaultKey: 'Ctrl+N'
  },
  {
    id: 'modal.close',
    category: 'card',
    name: 'Close Modal',
    description: 'Close the currently open modal or preview window',
    defaultKey: 'Escape'
  },

  // Navigation & Global
  {
    id: 'nav.newCards',
    category: 'navigation',
    name: 'Go to New Cards',
    description: 'Switch navigation tab to New Cards',
    defaultKey: 'Ctrl+1'
  },
  {
    id: 'nav.revision',
    category: 'navigation',
    name: 'Go to Revision',
    description: 'Switch navigation tab to Revision',
    defaultKey: 'Ctrl+2'
  },
  {
    id: 'nav.practice',
    category: 'navigation',
    name: 'Go to Practice',
    description: 'Switch navigation tab to Practice',
    defaultKey: 'Ctrl+3'
  },
  {
    id: 'nav.library',
    category: 'navigation',
    name: 'Go to Library',
    description: 'Switch navigation tab to Library',
    defaultKey: 'Ctrl+4'
  },
  {
    id: 'nav.search',
    category: 'navigation',
    name: 'Focus Search',
    description: 'Focus search bar in sidebar',
    defaultKey: 'Ctrl+K'
  },
  {
    id: 'nav.settings',
    category: 'navigation',
    name: 'Open Settings',
    description: 'Open the settings configuration modal',
    defaultKey: 'Ctrl+,'
  }
]

export const DEFAULT_SHORTCUTS: Record<string, string> = SHORTCUT_DEFINITIONS.reduce(
  (acc, def) => {
    acc[def.id] = def.defaultKey
    return acc
  },
  {} as Record<string, string>
)

/**
 * Normalizes a key string into standard canonical representation
 * e.g. "ctrl+shift+k" -> "Ctrl+Shift+K", " " -> "Space"
 */
export function normalizeKey(key: string): string {
  const trimmed = key.trim()
  if (trimmed.includes('+')) {
    return trimmed
      .split('+')
      .map(part => normalizeKey(part))
      .join('+')
  }

  const lower = trimmed.toLowerCase()
  if (lower === 'ctrl' || lower === 'control' || lower === 'cmd' || lower === 'meta') return 'Ctrl'
  if (lower === 'alt' || lower === 'option') return 'Alt'
  if (lower === 'shift') return 'Shift'
  if (trimmed === ' ' || lower === 'space') return 'Space'
  if (lower === 'escape' || lower === 'esc') return 'Escape'
  if (lower === 'enter' || lower === 'return') return 'Enter'
  if (lower === 'tab') return 'Tab'
  if (lower === 'backspace') return 'Backspace'
  if (lower === 'delete' || lower === 'del') return 'Delete'
  if (lower === 'arrowup' || lower === 'up') return 'ArrowUp'
  if (lower === 'arrowdown' || lower === 'down') return 'ArrowDown'
  if (lower === 'arrowleft' || lower === 'left') return 'ArrowLeft'
  if (lower === 'arrowright' || lower === 'right') return 'ArrowRight'
  
  if (trimmed.length === 1) {
    return trimmed.toUpperCase()
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

/**
 * Parses a KeyboardEvent into a canonical shortcut string, e.g. "Ctrl+Shift+K", "Space", "F", "Ctrl+Enter"
 */
export function parseKeyboardEvent(e: KeyboardEvent): string | null {
  // Ignore pure modifier presses
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
    return null
  }

  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')

  let mainKey = e.key
  if (e.code === 'Space' || mainKey === ' ') {
    mainKey = 'Space'
  } else if (e.code === 'Tab' || mainKey.toLowerCase() === 'tab') {
    mainKey = 'Tab'
  } else if (e.code === 'Enter' || e.code === 'NumpadEnter' || mainKey.toLowerCase() === 'enter') {
    mainKey = 'Enter'
  } else if (e.code === 'Escape' || mainKey.toLowerCase() === 'escape' || mainKey.toLowerCase() === 'esc') {
    mainKey = 'Escape'
  } else if (e.code.startsWith('Key') && e.code.length === 4) {
    mainKey = e.code.slice(3) // 'KeyF' -> 'F'
  } else if (e.code.startsWith('Digit') && e.code.length === 6) {
    mainKey = e.code.slice(5) // 'Digit1' -> '1'
  } else {
    mainKey = normalizeKey(mainKey)
  }

  parts.push(mainKey)
  return parts.join('+')
}

/**
 * Checks if a KeyboardEvent matches a configured shortcut string
 */
export function matchesShortcut(e: KeyboardEvent, shortcutCombo: string | undefined): boolean {
  if (!shortcutCombo) return false

  const parts = shortcutCombo.split('+').map(p => p.trim())
  const lowerParts = parts.map(p => p.toLowerCase())
  const hasCtrl = lowerParts.includes('ctrl') || lowerParts.includes('control') || lowerParts.includes('cmd') || lowerParts.includes('meta')
  const hasAlt = lowerParts.includes('alt') || lowerParts.includes('option')
  const hasShift = lowerParts.includes('shift')
  const mainKeyPart = parts.find(p => !['ctrl', 'control', 'cmd', 'meta', 'alt', 'option', 'shift'].includes(p.toLowerCase()))

  if (!mainKeyPart) return false

  // Check modifiers
  const ctrlPressed = e.ctrlKey || e.metaKey
  if (hasCtrl !== ctrlPressed) return false
  if (hasAlt !== e.altKey) return false
  if (hasShift !== e.shiftKey) return false

  // Check main key
  const normMain = normalizeKey(mainKeyPart).toLowerCase()
  
  if (normMain === 'space') {
    return e.key === ' ' || e.code === 'Space'
  }
  if (normMain === 'escape' || normMain === 'esc') {
    return e.key === 'Escape' || e.code === 'Escape'
  }
  if (normMain === 'enter') {
    return e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter'
  }
  if (normMain === 'tab') {
    return e.key.toLowerCase() === 'tab' || e.code === 'Tab'
  }

  // Single character / letter / number
  if (e.key.toLowerCase() === normMain) return true
  if (e.code.toLowerCase() === `key${normMain}`) return true
  if (e.code.toLowerCase() === `digit${normMain}`) return true

  return false
}

/**
 * Formats a shortcut string for display, adapting to OS if desired
 */
export function formatShortcutDisplay(combo: string): string {
  if (!combo) return ''
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
  
  return combo
    .split('+')
    .map(part => {
      const p = part.trim()
      const lower = p.toLowerCase()
      if (lower === 'ctrl' || lower === 'control' || lower === 'cmd' || lower === 'meta') {
        return isMac ? '⌘' : 'Ctrl'
      }
      if (lower === 'alt' || lower === 'option') {
        return isMac ? '⌥' : 'Alt'
      }
      if (lower === 'shift') {
        return isMac ? '⇧' : 'Shift'
      }
      return normalizeKey(p)
    })
    .join(isMac ? '' : ' + ')
}
