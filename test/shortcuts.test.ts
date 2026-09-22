import { describe, it, expect } from 'vitest'
import {
  SHORTCUT_DEFINITIONS,
  DEFAULT_SHORTCUTS,
  normalizeKey,
  parseKeyboardEvent,
  matchesShortcut,
  formatShortcutDisplay
} from '../src/utils/shortcuts'

describe('Shortcuts System - Revision Shuffle & Key Utilities', () => {
  it('TC-01: SHORTCUT_DEFINITIONS registers revision.shuffle with Ctrl+Tab defaultKey', () => {
    const shuffleDef = SHORTCUT_DEFINITIONS.find(def => def.id === 'revision.shuffle')
    expect(shuffleDef).toBeDefined()
    expect(shuffleDef?.category).toBe('revision')
    expect(shuffleDef?.name).toBe('Shuffle Remaining Cards')
    expect(shuffleDef?.defaultKey).toBe('Ctrl+Tab')

    expect(DEFAULT_SHORTCUTS['revision.shuffle']).toBe('Ctrl+Tab')
  })

  it('TC-02: normalizeKey normalizes tab variants and multi-key combos accurately', () => {
    expect(normalizeKey('tab')).toBe('Tab')
    expect(normalizeKey('Tab')).toBe('Tab')
    expect(normalizeKey('  tab  ')).toBe('Tab')
    expect(normalizeKey('TAB')).toBe('Tab')

    // Multi-key combos and modifier aliases per JSDoc specification
    expect(normalizeKey('ctrl+shift+k')).toBe('Ctrl+Shift+K')
    expect(normalizeKey('ctrl+tab')).toBe('Ctrl+Tab')
    expect(normalizeKey('cmd+tab')).toBe('Ctrl+Tab')
    expect(normalizeKey('ctrl+enter')).toBe('Ctrl+Enter')
  })

  it('TC-03: matchesShortcut matches Ctrl+Tab with case-insensitivity and OS aliases (Cmd/Meta)', () => {
    const ctrlTabEvent = {
      key: 'Tab',
      code: 'Tab',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false
    } as KeyboardEvent

    const metaTabEvent = {
      key: 'Tab',
      code: 'Tab',
      ctrlKey: false,
      metaKey: true,
      altKey: false,
      shiftKey: false
    } as KeyboardEvent

    // Canonical casing
    expect(matchesShortcut(ctrlTabEvent, 'Ctrl+Tab')).toBe(true)
    expect(matchesShortcut(metaTabEvent, 'Ctrl+Tab')).toBe(true)

    // Lowercase and case variations per Issue #10 body ("ctrl+tab")
    expect(matchesShortcut(ctrlTabEvent, 'ctrl+tab')).toBe(true)
    expect(matchesShortcut(metaTabEvent, 'ctrl+tab')).toBe(true)
    expect(matchesShortcut(ctrlTabEvent, 'CTRL+TAB')).toBe(true)
    expect(matchesShortcut(ctrlTabEvent, 'Ctrl+tab')).toBe(true)
    expect(matchesShortcut(ctrlTabEvent, 'cmd+tab')).toBe(true)
    expect(matchesShortcut(metaTabEvent, 'Cmd+Tab')).toBe(true)
  })

  it('TC-04: matchesShortcut does NOT trigger on invalid or conflicting modifier combinations', () => {
    // Plain Tab without Ctrl/Meta
    const plainTab = {
      key: 'Tab',
      code: 'Tab',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false
    } as KeyboardEvent
    expect(matchesShortcut(plainTab, 'Ctrl+Tab')).toBe(false)
    expect(matchesShortcut(plainTab, 'ctrl+tab')).toBe(false)

    // Ctrl+Shift+Tab
    const ctrlShiftTab = {
      key: 'Tab',
      code: 'Tab',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: true
    } as KeyboardEvent
    expect(matchesShortcut(ctrlShiftTab, 'Ctrl+Tab')).toBe(false)
    expect(matchesShortcut(ctrlShiftTab, 'ctrl+tab')).toBe(false)

    // Alt+Tab
    const altTab = {
      key: 'Tab',
      code: 'Tab',
      ctrlKey: false,
      metaKey: false,
      altKey: true,
      shiftKey: false
    } as KeyboardEvent
    expect(matchesShortcut(altTab, 'Ctrl+Tab')).toBe(false)
    expect(matchesShortcut(altTab, 'ctrl+tab')).toBe(false)

    // Ctrl+Alt+Tab
    const ctrlAltTab = {
      key: 'Tab',
      code: 'Tab',
      ctrlKey: true,
      metaKey: false,
      altKey: true,
      shiftKey: false
    } as KeyboardEvent
    expect(matchesShortcut(ctrlAltTab, 'Ctrl+Tab')).toBe(false)
    expect(matchesShortcut(ctrlAltTab, 'ctrl+tab')).toBe(false)

    // Ctrl+Enter (different key)
    const ctrlEnter = {
      key: 'Enter',
      code: 'Enter',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false
    } as KeyboardEvent
    expect(matchesShortcut(ctrlEnter, 'Ctrl+Tab')).toBe(false)
    expect(matchesShortcut(ctrlEnter, 'ctrl+tab')).toBe(false)
  })

  it('TC-05: parseKeyboardEvent parses Tab and Ctrl+Tab correctly with code and key fallback', () => {
    const ctrlTabEvent = {
      key: 'Tab',
      code: 'Tab',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false
    } as KeyboardEvent
    expect(parseKeyboardEvent(ctrlTabEvent)).toBe('Ctrl+Tab')

    const metaTabEvent = {
      key: 'Tab',
      code: 'Tab',
      ctrlKey: false,
      metaKey: true,
      altKey: false,
      shiftKey: false
    } as KeyboardEvent
    expect(parseKeyboardEvent(metaTabEvent)).toBe('Ctrl+Tab')

    const plainTabEvent = {
      key: 'Tab',
      code: 'Tab',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false
    } as KeyboardEvent
    expect(parseKeyboardEvent(plainTabEvent)).toBe('Tab')

    // Even if key is lowercase or code fallback is used
    const lowerTabEvent = {
      key: 'tab',
      code: 'Tab',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false
    } as KeyboardEvent
    expect(parseKeyboardEvent(lowerTabEvent)).toBe('Ctrl+Tab')
  })

  it('TC-06: formatShortcutDisplay correctly formats canonical and lowercase combos', () => {
    const formatted1 = formatShortcutDisplay('Ctrl+Tab')
    expect(formatted1).toContain('Tab')

    const formatted2 = formatShortcutDisplay('ctrl+tab')
    expect(formatted2).toContain('Tab')

    // Empty fallback
    expect(formatShortcutDisplay('')).toBe('')
  })

  it('TC-07: No shortcut collision among revision default shortcuts', () => {
    const revisionShortcuts = SHORTCUT_DEFINITIONS.filter(def => def.category === 'revision')
    const keys = revisionShortcuts.map(def => def.defaultKey)
    const uniqueKeys = new Set(keys)
    expect(uniqueKeys.size).toBe(keys.length)
  })

  it('TC-08: registers practice.clear and card.clear with Ctrl+Q defaultKey', () => {
    const practiceClear = SHORTCUT_DEFINITIONS.find(def => def.id === 'practice.clear')
    expect(practiceClear).toBeDefined()
    expect(practiceClear?.category).toBe('practice')
    expect(practiceClear?.defaultKey).toBe('Ctrl+Q')

    const cardClear = SHORTCUT_DEFINITIONS.find(def => def.id === 'card.clear')
    expect(cardClear).toBeDefined()
    expect(cardClear?.defaultKey).toBe('Ctrl+Q')

    const ctrlQEvent = {
      key: 'q',
      code: 'KeyQ',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false
    } as KeyboardEvent

    expect(matchesShortcut(ctrlQEvent, 'Ctrl+Q')).toBe(true)
    expect(matchesShortcut(ctrlQEvent, 'ctrl+q')).toBe(true)
  })
})
