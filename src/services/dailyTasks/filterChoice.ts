import { connectDatabase } from "@/lib/db"
import { UserModel } from "@/models/User"
import { NOTHING_NARROWED, type TaskNarrowing, type YesOrNo } from "@/lib/taskFilters"
import { PRIORITY_IDS, type Priority } from "@/constants/priorities"
import { TASK_DOER_IDS, type TaskDoer } from "@/constants/taskDoers"
import type { Viewer } from "@/types/auth"

/**
 * What Daily Tasks is narrowed to, kept **on the account itself**, so the list opens the same way in
 * any browser and after signing out and in. It is the person's own state, like the client last
 * chosen on Client Voices, which is why it is written against `viewer.id` rather than the workspace:
 * a child account looking at one priority never narrows its parent's list.
 *
 * Nothing here is validated a second time: the route checks the body with `TaskFiltersSchema`, and
 * anything that was somehow stored outside those words is read back as "not narrowed on" rather
 * than handed to the page, so a filter the list cannot offer can never hide every task.
 */

type Stored = { priority?: string; doer?: string; blocked?: string; done?: string } | null | undefined

// The words the list itself offers, so a filter can never be read back that the page cannot show
const YES_OR_NO = ["yes", "no"]

const one = <T extends string>(value: string | undefined, allowed: readonly string[]): T | "" =>
  value && allowed.includes(value) ? (value as T) : ""

/** The narrowing to open the list on. Anything missing or unknown reads as nothing narrowed. */
export async function readTaskFilters(viewer: Viewer): Promise<TaskNarrowing> {
  await connectDatabase()
  const account = (await UserModel.findById(viewer.id, { dailyTaskFilters: 1 }).lean()) as { dailyTaskFilters?: Stored } | null
  const saved = account?.dailyTaskFilters
  if (!saved) return NOTHING_NARROWED
  return {
    priority: one<Priority>(saved.priority, PRIORITY_IDS),
    doer: one<TaskDoer>(saved.doer, TASK_DOER_IDS),
    blocked: one<YesOrNo>(saved.blocked, YES_OR_NO),
    done: one<YesOrNo>(saved.done, YES_OR_NO),
  }
}

/**
 * Keeps what the list is narrowed to now. Clearing the filters is the same write with every field
 * empty, so "show everything again" is remembered exactly as a filter is.
 */
export async function saveTaskFilters(viewer: Viewer, filters: TaskNarrowing): Promise<TaskNarrowing> {
  await connectDatabase()
  await UserModel.updateOne({ _id: viewer.id }, { $set: { dailyTaskFilters: filters } })
  return filters
}
