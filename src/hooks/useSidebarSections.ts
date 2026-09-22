"use client"

import { useCallback, useSyncExternalStore } from "react"

/**
 * The sidebar section the user last opened (lib/sidebarSections.ts has the rule).
 *
 * Every page renders its own sidebar, so, like the dropdowns (hooks/useSidebarDropdowns.ts), the
 * choice is kept in localStorage: the open section stays open across pages and reloads until
 * the user clicks another heading.
 */
const STORAGE_KEY = "sidebarSection"
const CHANGE_EVENT = "sidebar-section-change"

// Where the choice lives when the browser refuses storage (private mode), so a click still works
let inMemory: string | null = null

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

function read(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? inMemory
  } catch {
    return inMemory
  }
}

export function useSidebarSections() {
  // The server has no storage, so it opens the section of the page being viewed
  const stored = useSyncExternalStore(subscribe, read, () => null)

  /** Remembers the open section: its id, or "" for none. */
  const setStored = useCallback((value: string) => {
    inMemory = value
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // Storage unavailable (private mode): the choice holds until the page is reloaded
    }
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  return { stored, setStored }
}
