import { PROJECT_ITEM_KIND_IDS, PROJECT_ITEM_KINDS, type ProjectItemKind } from "@/constants/clientProjectTasks"
import type { ProjectItemCount } from "@/types/clientProjectTasks"

/**
 * How each tab of a client project stands. Kept away from the database and from the page so the
 * arithmetic can be read and tested on its own: the server adds up its grouped query into the same
 * shape the pages work out from the items they are already holding, so a tab's count never depends
 * on which of the two produced it.
 */

/** Every tab at zero, so nothing ever has to check whether a tab is missing from the counts. */
export const emptyItemCounts = (): Record<ProjectItemKind, ProjectItemCount> =>
  Object.fromEntries(PROJECT_ITEM_KIND_IDS.map((id) => [id, { total: 0, done: 0 }])) as Record<ProjectItemKind, ProjectItemCount>

/** How one tab's items stand: how many there are and how many are ticked off. */
export const countItems = (items: readonly { status: string }[]): ProjectItemCount => ({
  total: items.length,
  done: items.filter((item) => item.status === "done").length,
})

/** Every tab's counts from one list of items, for a page that already holds them all. */
export const countsOf = (items: readonly { kind: ProjectItemKind; status: string }[]): Record<ProjectItemKind, ProjectItemCount> =>
  Object.fromEntries(PROJECT_ITEM_KINDS.map((kind) => [kind.id, countItems(items.filter((item) => item.kind === kind.id))])) as Record<
    ProjectItemKind,
    ProjectItemCount
  >

/** Every tab added up, which is what a project's row in the list says. */
export const totalItems = (counts: Record<ProjectItemKind, ProjectItemCount>): ProjectItemCount =>
  Object.values(counts).reduce((sum, count) => ({ total: sum.total + count.total, done: sum.done + count.done }), { total: 0, done: 0 })
