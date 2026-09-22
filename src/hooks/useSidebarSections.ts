"use client"

import { useCallback, useSyncExternalStore } from "react"
import { isSectionOpen, parseSectionChoices, withSectionToggled } from "@/lib/sidebarSections"

/**
 * Which sidebar sections the user has opened or closed (lib/sidebarSections.ts has the rule).
 *
 * Every page renders its own sidebar, so, like the dropdowns (hooks/useSidebarDropdowns.ts), the
 * choices are kept in localStorage: each section stays as the user left it across pages and
 * reloads, and only a click on its own heading changes it. The key is its own, because a section
 * and a tool can share an id ("clients").
 */
const STORAGE_KEY = "sidebarSections"
const CHANGE_EVENT = "sidebar-sections-change"

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

export function useSidebarSections() {
  // The server has no storage, so it opens only the section of the page being viewed
  const raw = useSyncExternalStore(subscribe, readRaw, () => "{}")
  const choices = parseSectionChoices(raw)

  /** Whether a section is open: the user's own choice, or open while one of its tools is on screen. */
  const isOpen = (id: string, containsCurrentPage: boolean) => isSectionOpen(choices, id, containsCurrentPage)

  /** Opens or closes one section, and remembers it. Every other section stays as it was. */
  const toggle = useCallback((id: string, open: boolean) => {
    inMemory = JSON.stringify(withSectionToggled(parseSectionChoices(readRaw()), id, open))
    try {
      localStorage.setItem(STORAGE_KEY, inMemory)
    } catch {
      // Storage unavailable (private mode): the choice holds until the page is reloaded
    }
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  return { isOpen, toggle }
}
