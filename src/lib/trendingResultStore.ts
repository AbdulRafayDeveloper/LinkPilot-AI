import { TRENDING_RESULT_RETENTION_HOURS } from "@/constants/trending"
import type { TrendingResult } from "@/services/trending/schema"

const STORAGE_KEY = "linkpilot:trending-topics"
const CHANGE_EVENT = "trending-topics-change"
// Bump when TrendingResult changes shape, so results saved by an older version are ignored
const STORAGE_VERSION = 1
const RETENTION_MS = TRENDING_RESULT_RETENTION_HOURS * 60 * 60 * 1000

export interface StoredTrendingResult {
  version: typeof STORAGE_VERSION
  savedAt: number
  result: TrendingResult
}

function isStoredTrendingResult(value: unknown): value is StoredTrendingResult {
  if (typeof value !== "object" || value === null) return false
  const record = value as Partial<StoredTrendingResult>
  const result = record.result as Partial<TrendingResult> | undefined
  return (
    record.version === STORAGE_VERSION &&
    typeof record.savedAt === "number" &&
    Array.isArray(result?.topics) &&
    typeof result?.research_metadata?.searched_at === "string"
  )
}

function parse(raw: string | null): StoredTrendingResult | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    return isStoredTrendingResult(value) ? value : null
  } catch {
    return null
  }
}

const isFresh = (stored: StoredTrendingResult) => Date.now() - stored.savedAt < RETENTION_MS

function readRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

// Parsed once per stored string, so the snapshot keeps a stable identity between renders
let cache: { raw: string | null; value: StoredTrendingResult | null } = { raw: null, value: null }

/**
 * The last search's results while they're younger than the retention window, else null.
 * A useSyncExternalStore snapshot: the same object is returned until the stored value changes.
 */
export function readStoredTrendingResult(): StoredTrendingResult | null {
  const raw = readRaw()
  if (raw !== cache.raw) cache = { raw, value: parse(raw) }
  return cache.value && isFresh(cache.value) ? cache.value : null
}

export function subscribeToStoredTrendingResult(onChange: () => void) {
  const stored = parse(readRaw())
  if (stored && !isFresh(stored)) {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Storage unavailable; the expired value is ignored anyway
    }
  }
  window.addEventListener("storage", onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

/**
 * Replaces the stored results with a new search's results. Failing to store (private
 * mode, full storage) only means the results won't survive a refresh.
 */
export function saveTrendingResult(result: TrendingResult) {
  const stored: StoredTrendingResult = { version: STORAGE_VERSION, savedAt: Date.now(), result }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch (error: unknown) {
    console.warn("Couldn't keep the trending topics for later:", error)
    return
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}
