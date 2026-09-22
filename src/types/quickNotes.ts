/**
 * One saved note, as the API serves it and the list shows it. `content` is formatted text (the
 * Markdown subset of lib/richText.ts), so a note saved as plain text reads exactly as it was typed.
 */
export interface QuickNote {
  id: string
  // "" when the note has no title
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

/** What a note is saved or edited with. The title is optional. */
export interface QuickNoteInput {
  title?: string
  content: string
}

/**
 * One batch of saved notes, newest first. `nextCursor` asks for the batch after this one and is
 * null at the end of the list. A cursor points at a note rather than counting from the start, so
 * deleting notes never makes the next batch skip or repeat any.
 */
export interface QuickNotesFeed {
  notes: QuickNote[]
  nextCursor: string | null
  total: number
}
