import { APP_TOOLS, TOOL_GROUPS } from "@/constants/linkedinTools"
import { HELP_DOCS, HELP_MESSAGES, HELP_START_TOPICS, MISSING_HELP_DOC } from "@/constants/helpDocs"
import { matchesWords } from "@/lib/nameSearch"
import type { HelpSection, HelpTopic } from "@/types/help"

/**
 * Which topics the Help & Documentation page lists, and which one the reader is on.
 *
 * **The topics are the app's own modules, in the sidebar's own order** (`APP_TOOLS`), so a tool
 * added to that one list is documented here without anybody keeping a second list of modules. The
 * page is read **without signing in**, so it describes the app as a whole rather than one account's
 * tools; the admin area is documented too, marked as what it is. Everything here is pure, so the
 * ordering, the searching and the scrolling rules are tested without a browser.
 */

/** The element each article is given, so a topic can be linked to and scrolled to. */
export const sectionDomId = (topicId: string) => `help-${topicId}`

/** Every topic the documentation has: the ones that open it, then one per module under its own area. */
export function helpSections(): HelpSection[] {
  const start: HelpSection = { id: "start", label: HELP_MESSAGES.startHeading, topics: [...HELP_START_TOPICS] }
  const areas = TOOL_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    hint: group.hint,
    topics: APP_TOOLS.filter((tool) => tool.group === group.id).map<HelpTopic>((tool) => ({
      id: tool.id,
      title: tool.title,
      href: tool.href,
      summary: tool.description,
      badge: tool.adminOnly ? HELP_MESSAGES.adminOnly : undefined,
      doc: HELP_DOCS[tool.id] ?? MISSING_HELP_DOC,
    })),
  })).filter((section) => section.topics.length > 0)
  return [start, ...areas]
}

/** Every topic on the page, in the order it is read, which is the order the list shows. */
export const flatTopics = (sections: readonly HelpSection[]): HelpTopic[] => sections.flatMap((section) => section.topics)

/**
 * The same sections with only the topics a search matches, and an area with none left out. The
 * words searched are the title and everything the article says, so "voice" finds the modules that
 * record one even where the title does not say so; a blank search is every topic, which is what
 * lets the page start whole.
 */
export function narrowSections(sections: readonly HelpSection[], query: string): HelpSection[] {
  if (!query.trim()) return [...sections]
  const words = (topic: HelpTopic) =>
    [topic.title, topic.doc.summary, ...topic.doc.steps, ...(topic.doc.notes ?? [])].join(" ")
  return sections
    .map((section) => ({ ...section, topics: section.topics.filter((topic) => matchesWords(words(topic), query)) }))
    .filter((section) => section.topics.length > 0)
}

/**
 * Which topic the reader is on: the last one whose heading has passed the line under the page's own
 * header, and the first topic until one has. Positions are measured from that line, so a heading
 * still below it is a positive number and one scrolled past is negative.
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
 * reader as well (it scrolls every ancestor that needs it, and the window is one of them).
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
