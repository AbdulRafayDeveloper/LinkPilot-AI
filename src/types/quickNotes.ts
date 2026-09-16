/**
 * One saved note, as the API serves it and the list shows it.
 */
export interface QuickNote {
  id: string
  content: string
  createdAt: string
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
