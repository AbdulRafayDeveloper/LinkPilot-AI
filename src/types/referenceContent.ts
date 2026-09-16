/**
 * One piece of saved reference content: what it is called and the text itself.
 */
export interface ReferenceItem {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

/**
 * One batch of saved content, newest first. `nextCursor` asks for the batch after this one and
 * is null at the end. A cursor points at an item rather than counting from the start, so adding
 * or deleting while browsing never makes the next batch skip or repeat one. `total` counts
 * everything the current search matches.
 */
export interface ReferenceItemsPage {
  items: ReferenceItem[]
  nextCursor: string | null
  total: number
}

export interface ReferenceItemInput {
  title: string
  content: string
}
