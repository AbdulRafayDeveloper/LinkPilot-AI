import { TOOL_GROUPS, type LinkedInTool } from "@/constants/linkedinTools"
import { HELP_DOCS, HELP_START_TOPICS, HELP_MESSAGES, MISSING_HELP_DOC } from "@/constants/helpDocs"
import type { HelpSection, HelpTopic } from "@/types/help"

/**
 * Which topics the Help & Documentation page lists, and which one the reader is on.
 *
 * **The topics are the app's own tools, in the sidebar's own order** (`APP_TOOLS` through
 * `toolsFor`), so a tool added to that one list is documented here without anybody adding it twice,
 * and a tool this account cannot open is not described to it. Everything here is pure, so the
 * ordering and the scrolling rules are tested without a browser (`tests/helpDocs.test.mjs`).
 */

/** The element each article is given, so a topic can be linked to and scrolled to. */
export const sectionDomId = (topicId: string) => `help-${topicId}`

/**
 * The page's topics: the few that open it (how the app works, the account, the shared prompts),
 * then one per tool under its own area's heading. An area the account has no tools in is left out
 * rather than drawn empty, exactly as the sidebar's rail leaves it out.
 */
export function helpTopicsFor(tools: readonly LinkedInTool[]): HelpSection[] {
  const start: HelpSection = { id: "start", label: HELP_MESSAGES.startHeading, topics: [...HELP_START_TOPICS] }
  const areas = TOOL_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    topics: tools
      .filter((tool) => tool.group === group.id)
      .map<HelpTopic>((tool) => ({ id: tool.id, title: tool.title, href: tool.href, doc: HELP_DOCS[tool.id] ?? MISSING_HELP_DOC })),
  })).filter((section) => section.topics.length > 0)
  return [start, ...areas]
}

/** Every topic on the page, in the order it is read, which is the order the sidebar lists. */
export const flatTopics = (sections: readonly HelpSection[]): HelpTopic[] => sections.flatMap((section) => section.topics)

/**
 * Which topic the reader is on: the last one whose heading has passed the top of the reading area,
 * and the first topic until one has. Positions are measured from the top of that area, so a
 * heading still below the fold is a positive number and one scrolled past is negative.
 */
export function activeTopicId(positions: readonly { id: string; top: number }[]): string {
  let active = positions[0]?.id ?? ""
  for (const position of positions) {
    if (position.top > 0) break
    active = position.id
  }
  return active
}

/**
 * Where the topic list should be scrolled to so the topic being read is in view, and **nothing
 * else**: the list's own `scrollTop`, never `scrollIntoView`, which would scroll the page under the
 * reader as well (it scrolls every ancestor that needs it, and the reading area is one of them).
 * A topic already in view leaves the list exactly where the reader put it.
 */
export function listScrollTop(
  current: number,
  link: { top: number; height: number },
  view: { height: number },
  margin = 12
): number {
  const above = link.top - margin
  const below = link.top + link.height + margin - view.height
  if (above < current) return Math.max(0, above)
  if (below > current) return below
  return current
}
