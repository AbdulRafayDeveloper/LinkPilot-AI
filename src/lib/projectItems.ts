import {
  ESTIMATE_UNITS,
  PROJECT_ITEM_KIND_IDS,
  PROJECT_ITEM_KINDS,
  PROJECT_TASK_MESSAGES,
  PROJECT_URL_MAX_LENGTH,
  projectItemKind,
  projectItemShape,
  type ProjectItemKind,
  type ProjectTaskStatus,
} from "@/constants/clientProjectTasks"
import type { ProjectEstimate, ProjectItemCount } from "@/types/clientProjectTasks"

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


/**
 * Every tab that can be ticked off, added up. A project's row says "3 of 7 done", and only work
 * that can be finished belongs in that: a credential, a link, a document or a backup is kept, not
 * done, so counting them would read as seven things undone the moment a project is set up.
 */
export const workItems = (counts: Record<ProjectItemKind, ProjectItemCount>): ProjectItemCount =>
  PROJECT_ITEM_KINDS.filter((kind) => kind.shape.tick).reduce(
    (sum, kind) => ({ total: sum.total + counts[kind.id].total, done: sum.done + counts[kind.id].done }),
    { total: 0, done: 0 }
  )

/**
 * A web address as it is stored: what was typed, with `https://` in front when no scheme was given,
 * which is what anyone pasting an address expects. An empty one stays empty.
 */
export const projectItemUrl = (url: string): string => {
  const typed = url.trim()
  if (!typed) return ""
  return /^[a-z][a-z0-9+.-]*:/i.test(typed) ? typed : `https://${typed}`
}

/** Whether an address is one this will show as a link: http or https, and nothing else. */
export const isWebAddress = (url: string): boolean => /^https?:\/\/\S+$/i.test(url) && url.length <= PROJECT_URL_MAX_LENGTH

/**
 * The name an item is saved under. A document and a backup may be added with nothing typed, in
 * which case the file's own name is what it is called, so uploading a backup is one click and the
 * list still reads. Every other kind keeps what was typed.
 */
export const itemName = (kind: ProjectItemKind, content: string, files: readonly { name: string }[]): string => {
  const typed = content.replace(/\s+/g, " ").trim()
  if (typed || !projectItemShape(kind).nameFromFile) return typed
  return (files[0]?.name ?? "").trim()
}

/**
 * What is still missing from an item of this kind, in the words the page shows, or null when it may
 * be saved. **One rule for both surfaces and both ends**: the composer asks it before it offers to
 * save, the schema asks it on a new item, and the service asks it again after an edit is merged in,
 * so a link can never be left without an address or a document without its file.
 */
export function itemProblem(
  kind: ProjectItemKind,
  item: { content: string; description?: string; url?: string; files?: readonly { name: string }[] }
): string | null {
  const shape = projectItemShape(kind)
  const files = item.files ?? []
  // The file comes first where the tab is the file: a backup with neither a file nor a name is
  // missing its file, which is the thing to say, and the name follows from it anyway
  if (shape.files === "required" && files.length === 0) return PROJECT_TASK_MESSAGES.missingFile
  if (!itemName(kind, item.content, files)) return PROJECT_TASK_MESSAGES.missingTask
  if (shape.text?.required && !(item.description ?? "").trim()) return PROJECT_TASK_MESSAGES.missingText(shape.text.label)
  if (shape.url) {
    const url = projectItemUrl(item.url ?? "")
    if (!url) return PROJECT_TASK_MESSAGES.missingUrl
    if (!isWebAddress(url)) return PROJECT_TASK_MESSAGES.badUrl
  }
  return null
}

/** How long something is expected to take, in words: "2 days", "1 hour", "" when nobody has said. */
export const estimateLabel = (estimate: ProjectEstimate | null | undefined): string => {
  if (!estimate || !estimate.value) return ""
  const unit = ESTIMATE_UNITS.find((entry) => entry.id === estimate.unit) ?? ESTIMATE_UNITS[1]
  return `${estimate.value} ${estimate.value === 1 ? unit.one : unit.label}`
}

/**
 * One tab's items as they are shown, each with **its own number**: the one it was given when it was
 * added and keeps for good, which is what the list draws down its side (1. 2. 3.). Dragging the
 * list changes where an item sits, never the number beside it.
 *
 * A numbered tab (the backups) is **newest first**, so the newest backup is at the top while #1
 * stays the first one ever taken; every other tab is in the order it was dragged into. An item
 * saved before numbering falls back to its place in the list, so nothing is ever drawn without one.
 *
 * **A ticked item goes to the end of its list, the rule a Daily Task follows** (at the owner's
 * request): on a tab whose items are ticked off, what is done sinks below what is still open, each
 * group keeping the order it was dragged into, and unticking brings an item back where it was. It
 * is a rule of how the list is **shown**, applied here on both surfaces, so it holds on load and
 * the moment a box is ticked, and nothing is written for it: an item's `position` is still the
 * drag order, and a drag sends the ids in the order on screen, so the next save simply writes
 * what was seen. Tabs with nothing to tick (credentials, links, documents, backups) are untouched.
 */
export const shownItems = <T extends { number?: number; status?: ProjectTaskStatus }>(kind: ProjectItemKind, items: readonly T[]): { item: T; number: number }[] => {
  const shape = projectItemKind(kind).shape
  // The number is the item's own, given when it was added, so dragging the list never renumbers it
  const numbered = items.map((item, index) => ({ item, number: item.number || index + 1 }))
  // A stable sort: only ticked and unticked change places
  const ordered = shape.numbered
    ? [...numbered].reverse()
    : shape.tick
      ? [...numbered].sort((first, second) => Number(first.item.status === "done") - Number(second.item.status === "done"))
      : numbered
  /**
   * The tabs added later (the roadmap, the notes, the team) are **counted off the list instead**,
   * at the owner's request, so the number beside a row always matches where that row is: a drag
   * renumbers them and nothing is stored for it. It is done after the order is settled, which is
   * what makes the two agree.
   */
  return shape.numberByOrder ? ordered.map((row, index) => ({ item: row.item, number: index + 1 })) : ordered
}

/**
 * The list as a drag left it, on the page, in the same way the server writes it: the items named
 * are handed back out into the places those items already occupied, so a tab whose folders are
 * being looked at one at a time keeps everything else exactly where it was.
 *
 * It is here rather than in the page so the two ends cannot drift: this is what the page shows the
 * moment a drag ends, and `reorderProjectTasks` is the same arithmetic against the database.
 */
export const reorderItems = <T extends { id: string }>(list: readonly T[], orderedIds: readonly string[]): T[] => {
  const moving = new Set(orderedIds)
  const slots = list.map((item, index) => (moving.has(item.id) ? index : -1)).filter((index) => index >= 0)
  if (slots.length !== orderedIds.length) return [...list]
  const byId = new Map(list.map((item) => [item.id, item]))
  const next = [...list]
  orderedIds.forEach((id, index) => {
    const item = byId.get(id)
    if (item) next[slots[index]] = item
  })
  return next
}

/**
 * Whether a file may be **opened as a page of its own**, rather than only shown inside the app.
 *
 * An SVG is never one. The app accepts `image/svg+xml` and an SVG is a document that can carry
 * script, so it is only ever rendered in an `<img>` (which never runs what is inside it) and is
 * not offered as a tab of its own on the storage host. A file with no preview link is not openable
 * either, since there is nothing to open.
 */
export const canOpenInTab = (file: { previewUrl: string | null; contentType: string }): boolean =>
  Boolean(file.previewUrl) && file.contentType.split(";")[0].trim().toLowerCase() !== "image/svg+xml"
