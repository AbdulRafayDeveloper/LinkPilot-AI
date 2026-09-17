"use client"

import { useCallback, useSyncExternalStore } from "react"

/**
 * Which sidebar dropdowns the user has opened or closed.
 *
 * Every page renders its own sidebar, so a dropdown kept in component state would snap shut on
 * every navigation. The choice is kept in localStorage instead, beside the collapse state, so a
 * dropdown stays exactly as the user left it until they click it again. Nothing else ever closes
 * it: not choosing one of its links, not moving to another tool, not a refresh.
 *
 * A dropdown the user has never touched starts open while one of its pages is on screen, so the
 * page they are on is always visible in the list.
 */
const STORAGE_KEY = "sidebarDropdowns"
const CHANGE_EVENT = "sidebar-dropdowns-change"

type DropdownChoices = Record<string, boolean>

// Where the choices live when the browser refuses storage (private mode), so a click still works
let inMemory = "{}"

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

// The raw string is the snapshot, because a parsed object would be a new value on every read
function readRaw(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? inMemory
  } catch {
    return inMemory
  }
}

function parse(raw: string): DropdownChoices {
  try {
    const value: unknown = JSON.parse(raw)
    return value && typeof value === "object" ? (value as DropdownChoices) : {}
  } catch {
    return {}
  }
}

export function useSidebarDropdowns() {
  // The server has no storage, so it renders every dropdown from the page being viewed alone
  const raw = useSyncExternalStore(subscribe, readRaw, () => "{}")
  const choices = parse(raw)

  /** Whether a dropdown is open: the user's own choice, or open while one of its pages shows. */
  const isOpen = (id: string, containsCurrentPage: boolean) => choices[id] ?? containsCurrentPage

  /** Opens or closes one dropdown, and remembers it. The only way a dropdown ever changes. */
  const setOpen = useCallback((id: string, open: boolean) => {
    inMemory = JSON.stringify({ ...parse(readRaw()), [id]: open })
    try {
      localStorage.setItem(STORAGE_KEY, inMemory)
    } catch {
      // Storage unavailable (private mode): the choice holds until the page is reloaded
    }
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  return { isOpen, setOpen }
}
