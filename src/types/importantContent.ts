export interface ImportantContent {
  id: string
  name: string
  description: string
  type: string
  // The size the description is written and read at, in pixels (CONTENT_TEXT_SIZES)
  textSize: number
  // The account that saved it, named only for an admin (who sees every account's entries)
  owner: string | null
  createdAt: string
  updatedAt: string
}

export interface ImportantContentInput {
  name: string
  description: string
  type: string
  // Left out, an entry keeps the size it has (a new one gets the default)
  textSize?: number
}

/** One page of entries. Paging is by page number, 50 to a page, so the page can jump between them. */
export interface ImportantContentPage {
  items: ImportantContent[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  // Every type the viewer's saved entries use, whatever the filters, for the type dropdown
  types: string[]
}
