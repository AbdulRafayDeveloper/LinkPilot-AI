import { FEATURE_API_PATHS } from "@/constants/featureAccess"

/**
 * Working out which tool a request belongs to, so a tool an admin has turned off for an account
 * can be refused wherever that account asks for it. Pure string work, no database and no imports
 * from the server, so both the proxy and the route guard can use it and it can be tested on its own.
 */

/** A path is a tool's when it is the tool's own path or something under it, never a longer name that merely starts the same. */
const isUnder = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`)

/**
 * The tool an API path belongs to, or null when it belongs to all of them (signing in, the admin area).
 * The longest matching path wins, the same rule pages follow, so a tool whose API sits inside another
 * tool's folder (Projects, under `/api/prompt-creator/projects`) is not taken for the outer one.
 */
export function toolIdForApiPath(pathname: string): string | null {
  // The "view all" pages share one route and name their tool in the path
  const saved = /^\/api\/saved-outputs\/([^/?]+)/.exec(pathname)
  if (saved) return saved[1]
  let best: { toolId: string; length: number } | null = null
  for (const [toolId, paths] of Object.entries(FEATURE_API_PATHS)) {
    for (const base of paths) {
      if (isUnder(pathname, base) && (!best || base.length > best.length)) best = { toolId, length: base.length }
    }
  }
  return best?.toolId ?? null
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

/**
 * One account's own choices, on top of the settings for everyone: the tools turned off for this
 * account alone, and the tools turned on for it although they are off for everyone else. Only a
 * difference from everyone else is ever stored, so an account with no choices of its own simply
 * follows whatever everyone gets, now and after the settings for everyone change.
 */
export interface FeatureOverrides {
  disabledTools: string[]
  enabledTools: string[]
}

/**
 * The tools an account may not use, all told: what is off for everyone, less what this account has
 * turned back on, plus what it has turned off itself. Its own choice always wins, and when a tool
 * somehow sits in both of its lists, off wins, because the safe mistake is a tool hidden rather than
 * one shown. An admin keeps every tool whatever is stored.
 */
export function effectiveDisabledTools(role: string, defaults: readonly string[], overrides: Partial<FeatureOverrides>): string[] {
  if (role === "admin") return []
  const off = new Set(defaults)
  for (const toolId of overrides.enabledTools ?? []) off.delete(toolId)
  for (const toolId of overrides.disabledTools ?? []) off.add(toolId)
  return [...off]
}

/**
 * Where the named tools land in one account's own choices when they are set on or off for it: only
 * the tools set against what everyone gets are kept as its own choice; a tool set to what everyone
 * gets anyway lands in neither list, so it follows everyone again. The caller takes the named tools
 * out of both lists and adds these, in one atomic update, leaving the account's other choices alone.
 */
export function placeTools(defaults: readonly string[], toolIds: readonly string[], on: boolean): FeatureOverrides {
  const offForEveryone = new Set(defaults)
  // On for this account where everyone has it off, or off where everyone has it on
  const againstEveryone = toolIds.filter((toolId) => on === offForEveryone.has(toolId))
  return on ? { disabledTools: [], enabledTools: againstEveryone } : { disabledTools: againstEveryone, enabledTools: [] }
}
