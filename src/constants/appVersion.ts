/**
 * Telling a tab that a new version of the app has been deployed (lib/appVersion.ts,
 * components/ui/UpdateToast.tsx). No polling and no socket: every answer from the server carries
 * the build that sent it, and the page compares it with the build it was loaded from.
 *
 * This file is imported by next.config.ts as well, so keep it free of `@/` imports.
 */

// The response header naming the build that answered (set for every path in next.config.ts)
export const APP_VERSION_HEADER = "x-app-version"

/**
 * What a tab coming back into view asks, so a tab that sat idle across a deploy still finds out. A
 * static file outside the sign-in gate (the proxy's matcher leaves it alone), so a signed-out page
 * can ask too, and the service worker only steps in on page loads, never on this.
 */
export const VERSION_PROBE_PATH = "/offline.html"

// A tab flicked back and forth asks at most this often; the answers from ordinary use count as well
export const VERSION_PROBE_MIN_GAP_MS = 60_000

export const APP_UPDATE_MESSAGES = {
  title: "A new version of LinkPilot is ready",
  body: "Refresh when it suits you to load the latest changes. Save anything you are writing first.",
  refresh: "Refresh now",
  refreshing: "Refreshing...",
  later: "Later",
  dismiss: "Dismiss this notice",
} as const
