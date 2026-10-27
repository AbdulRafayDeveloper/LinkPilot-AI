import type { ToolGroupId } from "@/constants/linkedinTools"

/**
 * Which of the three areas the sidebar is showing (Workspace, Client Work, LinkedIn Tools). The
 * rail picks one and the panel lists that area's tools alone, so a long list is three short ones.
 *
 * It is kept out of the component so the rule can be read and tested on its own, the way
 * `lib/projectItems.ts` holds a client project's rules.
 */

/** What a tool offers to match a page: its own page and every page inside it. */
export interface GroupedTool {
  group: ToolGroupId
  href: string
  links?: readonly { href: string }[]
}

/**
 * The area a page belongs to: the tool whose page it is, or whose page it is one of. **The longest
 * match wins**, the rule the feature gate follows for API paths, so `/comment-writer/profiles`
 * resolves to the page it really is rather than to the tool above it, and a page under a tool that
 * is not listed (`/connection-note/history`) still resolves through the tool's own address.
 */
export function groupOfPath(tools: readonly GroupedTool[], pathname: string): ToolGroupId | null {
  let best: { href: string; group: ToolGroupId } | null = null
  for (const tool of tools) {
    for (const href of [tool.href, ...(tool.links ?? []).map((link) => link.href)]) {
      if (pathname !== href && !pathname.startsWith(`${href}/`)) continue
      if (!best || href.length > best.href.length) best = { href, group: tool.group }
    }
  }
  return best?.group ?? null
}

/** The area the rail was last clicked on, with the page it was clicked on. */
export interface GroupPick {
  group: ToolGroupId
  path: string
}

/**
 * Which area the panel shows, in order of what the user most recently meant:
 *
 * 1. **The area they just clicked**, while they are still on the page they clicked it on. That is
 *    what makes looking through another area work at all: without the page, a click would be undone
 *    at once by the page's own area.
 * 2. **The area of the page on screen**, so arriving anywhere (a link, the switcher, a reload) shows
 *    the list that page is in, never a list without it.
 * 3. The area they last clicked, for a page that belongs to none (Global AI Prompts).
 * 4. The first area the account has, so something is always shown.
 *
 * An area the account cannot see (every tool in it turned off) is never chosen, which is why the
 * areas it does have are passed in rather than read from the full list.
 */
export function shownGroup(
  picked: GroupPick | null,
  pathname: string,
  pageGroup: ToolGroupId | null,
  available: readonly ToolGroupId[]
): ToolGroupId | null {
  if (picked && picked.path === pathname && available.includes(picked.group)) return picked.group
  if (pageGroup && available.includes(pageGroup)) return pageGroup
  if (picked && available.includes(picked.group)) return picked.group
  return available[0] ?? null
}

/** Reads what was stored, keeping only a pick that still looks like one. */
export function parseGroupPick(raw: string | null): GroupPick | null {
  try {
    const value: unknown = JSON.parse(raw ?? "null")
    if (!value || typeof value !== "object") return null
    const { group, path } = value as Partial<GroupPick>
    return typeof group === "string" && typeof path === "string" ? { group: group as ToolGroupId, path } : null
  } catch {
    return null
  }
}
