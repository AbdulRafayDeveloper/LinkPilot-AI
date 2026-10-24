import { projectItemShape, type ProjectItemKind, type ProjectPriority, type RoadmapStage } from "@/constants/clientProjectTasks"
import type { ProjectTask } from "@/types/clientProjectTasks"

/**
 * Narrowing one tab of a client project down to what is being looked for.
 *
 * It runs **on the page, over the items it already holds**, because a project arrives in one answer
 * with every tab in it (`tasksOfProject`), so there is nothing to ask the server for; it is the same
 * shape Daily Tasks' own narrowing has (`lib/taskFilters.ts`), kept out of the page so the rules can
 * be read and tested on their own.
 *
 * **Empty is how a filter says it is off**, which is also how the saved filters store one, so a page
 * that has never been filtered and one whose filters were cleared are the same thing.
 */

/** Yes, no, or not being narrowed on at all: the shape of every filter here but the search. */
export type ProjectFilterValues = {
  search: string
  priority: string
  // "open" or "done", on the tabs that can be ticked
  status: string
  // "signed" or "unsigned", on the tabs that can be signed off
  signed: string
  // One roadmap stage
  stage: string
  // "shared" or "internal", on the notes
  shared: string
}

export const NO_PROJECT_FILTERS: ProjectFilterValues = { search: "", priority: "", status: "", signed: "", stage: "", shared: "" }

/** Whether anything is being narrowed on, which is what shows Clear filters and the count. */
export const hasProjectFilters = (values: ProjectFilterValues): boolean =>
  Object.values(values).some((value) => value.trim() !== "")

/**
 * Which filters one tab really has. A tab with no tick box cannot be narrowed to what is done, and
 * a tab with no stage cannot be narrowed to one, so the bar offers what that tab carries and
 * nothing else; anything set on a tab that has not got it is simply not applied.
 */
export const projectFiltersFor = (kind: ProjectItemKind) => {
  const shape = projectItemShape(kind)
  return { search: true, priority: true, status: shape.tick, signed: shape.signOff, stage: shape.stage, shared: shape.shareable }
}

/** Every word typed has to appear somewhere in the item, in any order and whatever the case. */
const matchesSearch = (task: ProjectTask, search: string): boolean => {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = `${task.content} ${task.description} ${task.url} ${task.files.map((file) => file.name).join(" ")}`.toLowerCase()
  return words.every((word) => haystack.includes(word))
}

/**
 * One tab's items, less what the filters take out. Each filter is only applied where that tab has
 * it, so a value left over from another tab can never empty a list the user cannot put right.
 */
export function filterProjectItems(kind: ProjectItemKind, items: readonly ProjectTask[], values: ProjectFilterValues): ProjectTask[] {
  const offered = projectFiltersFor(kind)
  return items.filter((task) => {
    if (values.search.trim() && !matchesSearch(task, values.search.trim())) return false
    if (values.priority && task.priority !== (values.priority as ProjectPriority)) return false
    if (offered.status && values.status && (values.status === "done") !== (task.status === "done")) return false
    if (offered.signed && values.signed && (values.signed === "signed") !== Boolean(task.signedAt)) return false
    if (offered.stage && values.stage && (task.stage ?? "planned") !== (values.stage as RoadmapStage)) return false
    if (offered.shared && values.shared && (values.shared === "shared") !== task.isClientVisible) return false
    return true
  })
}
