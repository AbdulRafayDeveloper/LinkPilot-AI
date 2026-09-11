"use client"

import { useSyncExternalStore } from "react"

// A tool's inputs and results survive navigation, and refreshes for this long after the last change
const TOOL_STATE_RETENTION_HOURS = 24
const RETENTION_MS = TOOL_STATE_RETENTION_HOURS * 60 * 60 * 1000
const STORAGE_PREFIX = "linkpilot:tool:"

export interface ToolStore<S extends object> {
  getSnapshot: () => S
  getServerSnapshot: () => S
  subscribe: (listener: () => void) => () => void
  update: (patch: Partial<S> | ((current: S) => Partial<S>)) => void
  reset: () => void
}

interface ToolStoreOptions<S extends object> {
  // Bump when the state's shape changes, so state saved by an older version is ignored
  version: number
  // The part that survives a refresh; files and in-flight requests belong in memory only
  toStored?: (state: S) => Partial<S>
}

interface StoredState {
  version: number
  savedAt: number
  state: Record<string, unknown>
}

function isStoredState(value: unknown): value is StoredState {
  if (typeof value !== "object" || value === null) return false
  const record = value as Partial<StoredState>
  return typeof record.version === "number" && typeof record.savedAt === "number" && typeof record.state === "object" && record.state !== null
}

/**
 * State for one tool page that lives outside React, so leaving the page doesn't lose it:
 * inputs, selections and results are all still there when the user comes back, and a
 * request that was running keeps going and lands in the store. The stored part is also
 * mirrored to localStorage for 24 hours after the last change, so it survives a refresh.
 * Create one per tool at module level and read it with useToolStore.
 */
export function createToolStore<S extends object>(name: string, initial: S, options: ToolStoreOptions<S>): ToolStore<S> {
  const storageKey = `${STORAGE_PREFIX}${name}`
  const toStored = options.toStored ?? ((state: S) => state)
  const listeners = new Set<() => void>()
  let state = initial
  let isHydrated = false

  const readStored = (): Partial<S> | null => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return null
      const parsed: unknown = JSON.parse(raw)
      if (!isStoredState(parsed) || parsed.version !== options.version || Date.now() - parsed.savedAt >= RETENTION_MS) {
        localStorage.removeItem(storageKey)
        return null
      }
      // Only fields the tool still has are restored
      return Object.fromEntries(Object.entries(parsed.state).filter(([key]) => key in initial)) as Partial<S>
    } catch {
      return null
    }
  }

  const writeStored = () => {
    try {
      const stored: StoredState = { version: options.version, savedAt: Date.now(), state: { ...toStored(state) } }
      localStorage.setItem(storageKey, JSON.stringify(stored))
    } catch (error: unknown) {
      // Private mode or full storage: the state still survives navigation, just not a refresh
      console.warn(`Couldn't keep the ${name} state for later:`, error)
    }
  }

  const notify = () => listeners.forEach((listener) => listener())

  return {
    getSnapshot() {
      if (!isHydrated && typeof window !== "undefined") {
        isHydrated = true
        const stored = readStored()
        if (stored) state = { ...initial, ...stored }
      }
      return state
    },
    getServerSnapshot: () => initial,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    update(patch) {
      state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) }
      writeStored()
      notify()
    },
    reset() {
      state = initial
      try {
        localStorage.removeItem(storageKey)
      } catch {
        // Nothing stored to remove
      }
      notify()
    },
  }
}

export function useToolStore<S extends object>(store: ToolStore<S>): S {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
}
