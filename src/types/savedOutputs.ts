import type { PromptDependency } from "./promptCreator"

/**
 * One thing a tool wrote, read back from that tool's own collection and shaped the same way for
 * every tool, so one table can list notes, messages, comments, replies and prompts alike.
 */
export interface SavedOutputText {
  label: string
  text: string
}

export interface SavedOutput {
  id: string
  createdAt: string
  // Who it was for (the lead's name), or what it answered when a tool has no lead
  title: string
  subtitle: string | null
  // The choices it was written with (tone, tune, type, style, context), as their labels
  choices: string[]
  // Facts about the record itself: the company, "Edited by hand", the language it came from
  details: string[]
  // What was written, each part copied on its own: an InMail has a subject and a message
  texts: SavedOutputText[]
  characterCount: number | null
  // What it was written from ("Profile", "Conversation", "Post"), when there is one. The text itself
  // is read one record at a time, because a pasted profile or conversation can be very long
  sourceLabel: string | null
  // Which AI provider wrote it, for records saved since attribution existed
  provider?: string | null
  // The folder it is filed in, for a tool that has folders; null when it is in none
  folder?: { id: string; name: string } | null
  // When the user marked it as one they have used, for a tool that can be marked; null while unused
  appliedAt?: string | null
  // The records this one waits for, for a tool whose records have dependencies (Prompt Creator).
  // Empty means it waits for nothing, which is how every record saved before this reads
  dependencies?: PromptDependency[]
}

/** One record with the whole text it was written from. */
export interface SavedOutputDetail extends SavedOutput {
  source: string
}

export interface SavedOutputChoice {
  id: string
  label: string
}

export interface SavedOutputsPage {
  items: SavedOutput[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  // The options of a filter that come from the records themselves (clients, languages), by filter key
  choices: Partial<Record<"option" | "context", SavedOutputChoice[]>>
}

export interface SavedOutputFilters {
  page: number
  search: string
  option: string
  context: string
  // A folder id, UNFILED_FOLDER for the records in no folder, or "" for every folder
  folder: string
  // "independent", "ready", "blocked", or "" for records in any state
  dependencies: string
  from: string | null
  to: string | null
}
