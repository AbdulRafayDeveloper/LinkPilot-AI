"use client"

import { useSyncExternalStore } from "react"
import { reportToolStatus } from "./toolActivity"

// A tool's inputs and results survive navigation, and refreshes for this long after the last change
const TOOL_STATE_RETENTION_HOURS = 24
const RETENTION_MS = TOOL_STATE_RETENTION_HOURS * 60 * 60 * 1000
const STORAGE_PREFIX = "linkpilot:tool:"

// sessionStorage is this browser tab's own copy; localStorage is the latest copy from any tab
type StorageKind = "sessionStorage" | "localStorage"
const ALL_STORAGES: readonly StorageKind[] = ["sessionStorage", "localStorage"]

// Reading window.localStorage or window.sessionStorage throws when the browser blocks site data
function storageOf(kind: StorageKind): Storage | null {
  try {
    return window[kind]
  } catch {
    return null
  }
}

/**
 * Removes every tool's saved inputs and results from this browser, so the next account to sign in
 * here starts clean instead of seeing what the last one typed.
 */
export function clearAllToolState(): void {
  for (const kind of ALL_STORAGES) {
    const storage = storageOf(kind)
    if (!storage) continue
    Object.keys(storage)
      .filter((key) => key.startsWith(STORAGE_PREFIX))
      .forEach((key) => storage.removeItem(key))
  }
}

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
  // Result stores: the tool's page and its status, so the sidebar and header can show
  // a generation running or finished in the background (lib/toolActivity.ts)
  activity?: { href: string; statusOf: (state: S) => string }
  /**
   * The fields that are a **choice rather than a piece of work**: a chosen target, project or
   * tone. What the user typed and what a tool wrote are theirs for the session and are forgotten
   * after TOOL_STATE_RETENTION_HOURS, but a choice is a standing preference, so these are kept in
   * their own localStorage key with no expiry and come back after a browser restart, a week later,
   * or in a brand-new tab, the way the sidebar remembers being collapsed.
   *
   * The tab's own state still wins while it has one, so two tabs never swap choices mid-session,
   * and Reset keeps them rather than putting the defaults back.
   */
  remember?: readonly (keyof S)[]
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
 * request that was running keeps going and lands in the store. Create one per tool at
 * module level and read it with useToolStore.
 *
 * Each browser tab works on its own state. The stored part is kept in the tab's
 * sessionStorage, so the same tool open in several tabs never swaps one tab's inputs or
 * result for another's, even when the browser reloads a background tab or the dev server
 * hot-reloads. It's also mirrored to localStorage for 24 hours after the last change, and
 * only a brand-new tab starts from that latest copy.
 */
export function createToolStore<S extends object>(name: string, initial: S, options: ToolStoreOptions<S>): ToolStore<S> {
  const storageKey = `${STORAGE_PREFIX}${name}`
  // Its own key, so the choices outlive the state they were made in rather than expiring with it
  const choiceKey = `${STORAGE_PREFIX}choice:${name}`
  const remembered = options.remember ?? []
  const toStored = options.toStored ?? ((state: S) => state)
  const listeners = new Set<() => void>()
  let state = initial
  let isHydrated = false

  const readStored = (kind: StorageKind): Partial<S> | null => {
    const storage = storageOf(kind)
    if (!storage) return null
    try {
      const raw = storage.getItem(storageKey)
      if (!raw) return null
      const parsed: unknown = JSON.parse(raw)
      if (!isStoredState(parsed) || parsed.version !== options.version || Date.now() - parsed.savedAt >= RETENTION_MS) {
        storage.removeItem(storageKey)
        return null
      }
      // Only fields the tool still has are restored
      return Object.fromEntries(Object.entries(parsed.state).filter(([key]) => key in initial)) as Partial<S>
    } catch {
      return null
    }
  }

  /** The choices kept for good, or null when there are none or they were saved by an older version. */
  const readChoices = (): Partial<S> | null => {
    if (remembered.length === 0) return null
    const storage = storageOf("localStorage")
    if (!storage) return null
    try {
      const raw = storage.getItem(choiceKey)
      if (!raw) return null
      const parsed: unknown = JSON.parse(raw)
      if (!isStoredState(parsed) || parsed.version !== options.version) {
        storage.removeItem(choiceKey)
        return null
      }
      // Only the fields still asked to be remembered, and only ones the tool still has
      return Object.fromEntries(
        Object.entries(parsed.state).filter(([key]) => key in initial && remembered.includes(key as keyof S))
      ) as Partial<S>
    } catch {
      return null
    }
  }

  const writeChoices = (current: S) => {
    if (remembered.length === 0) return
    const chosen = Object.fromEntries(remembered.map((key) => [key, current[key]]))
    try {
      storageOf("localStorage")?.setItem(choiceKey, JSON.stringify({ version: options.version, savedAt: Date.now(), state: chosen }))
    } catch (error: unknown) {
      // Private mode or full storage: the choice still holds for this session, just not the next one
      console.warn(`Couldn't remember the ${name} choices:`, error)
    }
  }

  const writeStored = (stored: Partial<S>, kinds: readonly StorageKind[]) => {
    const record: StoredState = { version: options.version, savedAt: Date.now(), state: { ...stored } }
    const serialized = JSON.stringify(record)
    for (const kind of kinds) {
      try {
        storageOf(kind)?.setItem(storageKey, serialized)
      } catch (error: unknown) {
        // Private mode or full storage: the state still survives navigation, just not a refresh
        console.warn(`Couldn't keep the ${name} state for later:`, error)
      }
    }
  }

  const notify = () => {
    if (options.activity) reportToolStatus(options.activity.href, options.activity.statusOf(state))
    listeners.forEach((listener) => listener())
  }

  return {
    getSnapshot() {
      if (!isHydrated && typeof window !== "undefined") {
        isHydrated = true
        // This tab's own state first; a brand-new tab starts from the latest one and keeps it as its own
        const ownState = readStored("sessionStorage")
        const stored = ownState ?? readStored("localStorage")
        // The choices come first and the state on top, so a tab that is already working keeps the
        // choices it is working with, and a new one starts from the last choice made anywhere
        const choices = readChoices()
        if (stored || choices) {
          state = { ...initial, ...choices, ...stored }
          if (!ownState) writeStored(toStored(state), ["sessionStorage"])
        }
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
      writeStored(toStored(state), ALL_STORAGES)
      writeChoices(state)
      notify()
    },
    reset() {
      // Reset clears the work, never the choices: the tool comes back empty on the target, the
      // project and the tone the user had picked, which is what every tool's Reset button means
      state = { ...initial, ...(readChoices() ?? {}) }
      // The tab remembers that it was cleared, so a reload never brings back another tab's state
      writeStored(toStored(state), ["sessionStorage"])
      try {
        storageOf("localStorage")?.removeItem(storageKey)
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
