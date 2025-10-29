/**
 * Keyboard Shortcuts Hook
 * Provides keyboard navigation for customer analysis
 */

import { useEffect } from 'react'

interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  callback: () => void
  description: string
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const matchingShortcut = shortcuts.find((shortcut) => {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
        const ctrlMatch = shortcut.ctrlKey ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey
        const shiftMatch = shortcut.shiftKey ? event.shiftKey : !event.shiftKey

        return keyMatch && ctrlMatch && shiftMatch
      })

      if (matchingShortcut) {
        event.preventDefault()
        matchingShortcut.callback()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [shortcuts, enabled])
}

// Common shortcuts for Customer Analysis
export const ANALYSIS_SHORTCUTS = {
  NEW_ANALYSIS: { key: 'n', ctrlKey: true, description: 'New Analysis' },
  EXPORT_PDF: { key: 'p', ctrlKey: true, description: 'Export as PDF' },
  EXPORT_CSV: { key: 'e', ctrlKey: true, description: 'Export as CSV' },
  REFRESH: { key: 'r', ctrlKey: true, description: 'Refresh Results' },
  HELP: { key: '?', shiftKey: true, description: 'Show Keyboard Shortcuts' },
}
