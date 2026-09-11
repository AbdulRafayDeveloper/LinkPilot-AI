"use client"

import { useCallback, useSyncExternalStore } from "react"

const STORAGE_KEY = "isSidebarCollapsed"
const CHANGE_EVENT = "sidebar-collapse-change"

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

/**
 * Desktop sidebar collapse state, persisted in localStorage under the same key the
 * other pages use. Hydration-safe: the server render always starts expanded.
 */
export function useSidebarCollapse() {
  const isCollapsed = useSyncExternalStore(subscribe, readCollapsed, () => false)

  const toggleCollapsed = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(!readCollapsed()))
    } catch {
      // Storage unavailable (private mode); the toggle simply won't persist
    }
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  return { isCollapsed, toggleCollapsed }
}
