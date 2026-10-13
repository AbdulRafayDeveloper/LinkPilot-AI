"use client"

import { useCallback, useSyncExternalStore } from "react"
import { parseGroupPick, type GroupPick } from "@/lib/sidebarGroups"
import type { ToolGroupId } from "@/constants/linkedinTools"

/**
 * Which area of the app the sidebar's rail is showing (lib/sidebarGroups.ts has the rule).
 *
 * Every page renders its own sidebar, so, like the dropdowns (hooks/useSidebarDropdowns.ts), the
 * choice is kept in localStorage: the area stays as the user left it across pages and reloads. The
 * **page it was chosen on** is stored with it, because a click on the rail only outlives the page
 * it was made on; after that the page's own area is what the panel shows.
 */
const STORAGE_KEY = "sidebarGroup"
const CHANGE_EVENT = "sidebar-group-change"

// Where the choice lives when the browser refuses storage (private mode), so a click still works
let inMemory = "null"

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

export function useSidebarGroup(): { picked: GroupPick | null; pick: (group: ToolGroupId, path: string) => void } {
  // The server has no storage, so it shows the area of the page being rendered
  const raw = useSyncExternalStore(subscribe, readRaw, () => "null")

  /** Remembers the area that was clicked, and the page it was clicked on. */
  const pick = useCallback((group: ToolGroupId, path: string) => {
    inMemory = JSON.stringify({ group, path })
    try {
      localStorage.setItem(STORAGE_KEY, inMemory)
    } catch {
      // Storage unavailable (private mode): the choice holds until the page is reloaded
    }
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  return { picked: parseGroupPick(raw), pick }
}
