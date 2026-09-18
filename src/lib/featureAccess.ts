import { FEATURE_API_PATHS } from "@/constants/featureAccess"

/**
 * Working out which tool a request belongs to, so a tool an admin has turned off for an account
 * can be refused wherever that account asks for it. Pure string work, no database and no imports
 * from the server, so both the proxy and the route guard can use it and it can be tested on its own.
 */

/** A path is a tool's when it is the tool's own path or something under it, never a longer name that merely starts the same. */
const isUnder = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`)

/** The tool an API path belongs to, or null when it belongs to all of them (signing in, the admin area). */
export function toolIdForApiPath(pathname: string): string | null {
  // The "view all" pages share one route and name their tool in the path
  const saved = /^\/api\/saved-outputs\/([^/?]+)/.exec(pathname)
  if (saved) return saved[1]
  for (const [toolId, paths] of Object.entries(FEATURE_API_PATHS)) {
    if (paths.some((base) => isUnder(pathname, base))) return toolId
  }
  return null
}

/**
 * The tool a page belongs to, from the tools' own `href`s. The longest match wins, so a tool whose
 * address sits under another's still resolves to itself rather than to the shorter one.
 */
export function toolIdForPagePath(pathname: string, tools: readonly { id: string; href: string }[]): string | null {
  const match = tools
    .filter((tool) => isUnder(pathname, tool.href))
    .sort((a, b) => b.href.length - a.href.length)[0]
  return match?.id ?? null
}

/**
 * Whether a tool is off for this account. An admin always keeps every tool: they are the ones who
 * turn tools off, and locking an admin out of the admin area would leave nobody able to undo it.
 */
export function isFeatureDisabled(viewer: { role: string; disabledTools?: string[] } | null, toolId: string | null): boolean {
  if (!viewer || !toolId || viewer.role === "admin") return false
  return (viewer.disabledTools ?? []).includes(toolId)
}
