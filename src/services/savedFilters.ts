import { connectDatabase } from "@/lib/db"
import { UserModel } from "@/models/User"
import { cleanFilters, NO_SAVED_FILTERS, type SavedFilters } from "@/lib/savedFilters"
import { isFilterView } from "@/constants/savedFilters"
import type { Viewer } from "@/types/auth"

/**
 * The filters each page was last left on, kept **on the account itself**, so every list opens the
 * way its user left it: after moving to another tool, after a reload, and after signing out and in,
 * on any machine.
 *
 * It is the person's own state rather than the workspace's, which is why it is written against
 * `viewer.id` like the client last chosen on Client Voices.
 *
 * **One view is written at a time** (`viewFilters.<view>`), so two tabs on two different pages never
 * overwrite each other's filters, and a page that has never been filtered simply has nothing stored.
 */

type Stored = Record<string, unknown> | null | undefined

/** What one page was left filtered on. Anything unknown or stale reads as no filter at all. */
export async function readFilters(viewer: Viewer, view: string): Promise<SavedFilters> {
  if (!isFilterView(view)) return NO_SAVED_FILTERS
  await connectDatabase()
  const account = (await UserModel.findById(viewer.id, { viewFilters: 1 }).lean()) as { viewFilters?: Stored } | null
  return cleanFilters(view, account?.viewFilters?.[view])
}

/**
 * Keeps what one page is filtered on now. Clearing the filters is the same call with nothing in it,
 * so "show everything again" is remembered exactly as a filter is.
 */
export async function saveFilters(viewer: Viewer, view: string, filters: unknown): Promise<SavedFilters> {
  if (!isFilterView(view)) return NO_SAVED_FILTERS
  const kept = cleanFilters(view, filters)
  await connectDatabase()
  await UserModel.updateOne({ _id: viewer.id }, { $set: { [`viewFilters.${view}`]: kept } })
  return kept
}
