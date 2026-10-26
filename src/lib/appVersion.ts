import { APP_VERSION_HEADER, VERSION_PROBE_MIN_GAP_MS, VERSION_PROBE_PATH } from "@/constants/appVersion"

/**
 * Whether the server is now running a different build from the one this tab was loaded from.
 *
 * Nothing here asks the server on a timer. Every request the page already makes goes through
 * `fetchWithRetry`, which hands the answer's `x-app-version` to `noteServerVersion`; a tab that comes
 * back into view asks once (`checkForUpdate`), so one left idle across a deploy finds out too. Different
 * is enough, not newer: a rolled back deploy also means this tab is not running what the server is.
 */

// The build this page was compiled in, set as a constant by next.config.ts (`env`), never configured
const RUNNING_VERSION = process.env.APP_BUILD_VERSION ?? null

/** Whether an answer from `seen` means the tab is out of date. No header (another site, an old build) says nothing. */
export const isOtherVersion = (running: string | null, seen: string | null | undefined): seen is string =>
  Boolean(running && seen && seen !== running)

let latestVersion: string | null = null
let lastProbeAt = 0
const listeners = new Set<() => void>()

/** Notes the build an answer came from, and tells the page when that is not this tab's build. */
export function noteServerVersion(seen: string | null | undefined): void {
  if (!isOtherVersion(RUNNING_VERSION, seen) || seen === latestVersion) return
  latestVersion = seen
  listeners.forEach((listener) => listener())
}

/** Asks which build is live now, at most once a minute. A failure says nothing: the next answer will. */
export async function checkForUpdate(): Promise<void> {
  const now = Date.now()
  if (now - lastProbeAt < VERSION_PROBE_MIN_GAP_MS) return
  lastProbeAt = now
  try {
    const response = await fetch(VERSION_PROBE_PATH, { method: "HEAD", cache: "no-store" })
    noteServerVersion(response.headers.get(APP_VERSION_HEADER))
  } catch {
    // Offline or the connection dropped: nothing to learn this time
  }
}

// For useSyncExternalStore: the build the server is on, once it differs from this tab's, else null
export const subscribeToAppVersion = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export const latestAppVersion = () => latestVersion
export const noAppVersion = () => null
