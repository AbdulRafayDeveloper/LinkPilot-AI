import type { ToolGroupId } from "@/constants/linkedinTools"

/**
 * Help & Documentation: one short article per module, and the topics the page lists them under.
 * The articles are plain text (`constants/helpDocs.ts`) rather than Markdown, so the page needs no
 * parser and the words can be read as they are written.
 */

export interface HelpDoc {
  // One sentence: what this module is for
  summary: string
  // How to use it, in the order it is used
  steps: string[]
  // Worth knowing: a limit, where something is saved, or what the module will not do
  notes?: string[]
  // Left for later: shown as such on the page rather than read as finished documentation
  todo?: boolean
}

/** One article on the page, and the entry the topic list shows for it. */
export interface HelpTopic {
  id: string
  title: string
  // The page this article is about, so the reader can open it; absent for an article about no one page
  href?: string
  // The one line the sidebar shows for this tool, under its name in the topic list
  summary?: string
  // Said on the article where something must be known before reading it ("Admins only")
  badge?: string
  doc: HelpDoc
}

/** The topics under one heading: the app's own areas, plus the one the page opens with. */
export interface HelpSection {
  id: ToolGroupId | "start"
  label: string
  // What the area is for, in the sidebar's own words; absent on the opening section
  hint?: string
  topics: HelpTopic[]
}
