import { connectDatabase } from "@/lib/db"
import { allOf, searchCondition } from "@/lib/listQuery"
import { planLinkMatches, planLinkToken, readPlanLinkToken } from "@/lib/planLink"
import { EmployeeModel, EmployeePlanModel, type IEmployee, type IEmployeePlan, type IPlanItem, type IPlanTask } from "@/models/Employee"
import { EMPLOYEES_LIST_MAX, PLAN_HISTORY_DAYS, PLAN_PERIOD, type EmployeeStatus } from "@/constants/employees"
import { shiftDate } from "@/lib/taskDates"
import type {
  Employee,
  EmployeeInput,
  EmployeePlan,
  EmployeePlanInput,
  EmployeesPage,
  PlanHistoryDay,
  PlanHistoryPage,
  PlanItem,
  PublicPlan,
} from "@/types/employees"
import type { Viewer } from "@/types/auth"
import { visibleById, visibleTo } from "@/services/auth/viewer"
import { accountNames } from "@/services/auth/accounts"

/**
 * Employees and their daily plans. An employee belongs to the account that added them: a user
 * sees and plans for their own, an admin sees everyone's (each named with the account that added
 * them). A plan is reached either through an employee the viewer may see, or through that
 * employee's own signed link (findEmployeeByPlanLink), which opens nothing else.
 */

type StoredEmployee = IEmployee & { _id: { toString: () => string } }

const toEmployee = (record: StoredEmployee, owner: string | null): Employee => {
  const id = record._id.toString()
  return {
    id,
    name: record.name,
    city: record.city,
    role: record.role,
    joiningDate: record.joiningDate,
    status: record.status,
    planLink: record.planLinkActive ? planLinkToken(id, record.planLinkVersion ?? 0) : null,
    owner,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

// Only an admin sees other accounts' employees, so only an admin needs their authors named
async function withOwners(viewer: Viewer, records: StoredEmployee[]): Promise<Employee[]> {
  if (viewer.role !== "admin") return records.map((record) => toEmployee(record, null))
  const names = await accountNames(records.map((record) => record.ownerId ?? ""))
  return records.map((record) => toEmployee(record, names.get(record.ownerId ?? "") ?? "Before accounts"))
}

/** One batch of employees, newest first, searched by name, city or role and filtered by status. */
export async function listEmployees(
  viewer: Viewer,
  filters: { cursor: string | null; search: string; status: EmployeeStatus | "" }
): Promise<EmployeesPage> {
  await connectDatabase()
  const scope = visibleTo(viewer)
  const matching = allOf([scope, searchCondition(filters.search, ["name", "city", "role"]), filters.status ? { status: filters.status } : null])
  const [records, total, active, inactive] = await Promise.all([
    // The whole team at once, in the order it was dragged into, so it can be reordered as one list
    EmployeeModel.find(matching).sort({ position: 1, createdAt: -1, _id: -1 }).limit(EMPLOYEES_LIST_MAX).lean(),
    EmployeeModel.countDocuments(matching),
    EmployeeModel.countDocuments({ ...scope, status: "active" }),
    EmployeeModel.countDocuments({ ...scope, status: "inactive" }),
  ])
  return {
    items: await withOwners(viewer, records as unknown as StoredEmployee[]),
    nextCursor: null,
    total,
    counts: { active, inactive },
  }
}

export async function getEmployee(viewer: Viewer, id: string): Promise<Employee | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  const record = (await EmployeeModel.findOne(filter).lean()) as unknown as StoredEmployee | null
  return record ? (await withOwners(viewer, [record]))[0] : null
}

export async function createEmployee(viewer: Viewer, input: EmployeeInput): Promise<Employee> {
  await connectDatabase()
  // A new employee goes to the top of the team, above anyone already placed there
  const first = await EmployeeModel.findOne(visibleTo(viewer), { position: 1 }).sort({ position: 1 }).lean()
  const record = await EmployeeModel.create({ ownerId: viewer.id, ...input, position: first ? first.position - 1 : 0 })
  return (await withOwners(viewer, [record.toObject() as unknown as StoredEmployee]))[0]
}

/**
 * Puts the team in a new order: `orderedIds` is every employee the viewer may see, top to bottom.
 * An order that doesn't name exactly those employees (one was added or removed in another tab) is
 * refused as "changed" rather than guessed at. The positions are written in one bulk write.
 */
export async function reorderEmployees(viewer: Viewer, orderedIds: string[]): Promise<"saved" | "changed"> {
  await connectDatabase()
  const team = await EmployeeModel.find(visibleTo(viewer), { _id: 1 }).lean()
  const ids = new Set(team.map((record) => String(record._id)))
  if (ids.size !== orderedIds.length || orderedIds.some((id) => !ids.has(id))) return "changed"
  await EmployeeModel.bulkWrite(
    orderedIds.map((id, position) => ({ updateOne: { filter: { _id: id, ...visibleTo(viewer) }, update: { $set: { position } } } })),
    { ordered: false }
  )
  return "saved"
}

/** Replaces an employee's details. Null when they no longer exist, or belong to another account. */
export async function updateEmployee(viewer: Viewer, id: string, input: EmployeeInput): Promise<Employee | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  const record = (await EmployeeModel.findOneAndUpdate(filter, input, { returnDocument: "after", runValidators: true }).lean()) as unknown as StoredEmployee | null
  return record ? (await withOwners(viewer, [record]))[0] : null
}

/** Deletes an employee and every plan made for them, so nothing is left pointing at no one. */
export async function deleteEmployee(viewer: Viewer, id: string): Promise<boolean> {
  const filter = visibleById(viewer, id)
  if (!filter) return false
  await connectDatabase()
  const { deletedCount } = await EmployeeModel.deleteOne(filter)
  if (deletedCount > 0) await EmployeePlanModel.deleteMany({ employeeId: id })
  return deletedCount > 0
}

/**
 * Turns the employee's own link on, replaces it (every earlier link stops working) or turns it
 * off. Turning it back on after that makes a new link too, so an old one never comes back to life.
 */
export async function setPlanLink(viewer: Viewer, id: string, action: "create" | "replace" | "disable"): Promise<Employee | null> {
  const filter = visibleById(viewer, id)
  if (!filter) return null
  await connectDatabase()
  const update = action === "disable" ? { $set: { planLinkActive: false } } : { $set: { planLinkActive: true }, $inc: { planLinkVersion: 1 } }
  const record = (await EmployeeModel.findOneAndUpdate(filter, update, { returnDocument: "after" }).lean()) as unknown as StoredEmployee | null
  return record ? (await withOwners(viewer, [record]))[0] : null
}

// --- The daily plan ------------------------------------------------------------------------------
//
// An employee has **one** plan: the tasks that repeat every day, in order, kept on the employee. Each
// day gets its own record, a copy of those tasks with that day's ticks and their times. Today's
// record always follows the plan (a task added, reworded, moved or removed shows up at once, and
// the ticks on the tasks that stay are kept); earlier days' records are never touched again, so the
// history is what the plan and the ticks really were on each day. A new day starts from the plan
// with nothing ticked, never empty.

type PlanOwner = Pick<StoredEmployee, "_id" | "ownerId" | "planItems" | "planNotes" | "planStartedAt" | "planDay">

const PLAN_FIELDS = {
  ownerId: 1,
  planItems: 1,
  planNotes: 1,
  planStartedAt: 1,
  planDay: 1,
  linkOrder: 1,
  planLinkActive: 1,
  planLinkVersion: 1,
  status: 1,
  name: 1,
  role: 1,
} as const

const toItem = (item: IPlanItem): PlanItem => ({
  id: item.id,
  text: item.text,
  done: Boolean(item.done),
  completedAt: item.done && item.completedAt ? new Date(item.completedAt).toISOString() : null,
  // A finished task has nothing to explain, so a reason only ever shows on one that is still open
  reason: item.done ? "" : (item.reason ?? ""),
})

// One day as the history shows it: the tasks that day's plan held, and how many were ticked off
const toHistoryDay = (record: IEmployeePlan): PlanHistoryDay => {
  const items = (record.items ?? []).map(toItem)
  return { date: record.periodStart, items, doneCount: items.filter((item) => item.done).length }
}

const findDay = (employeeId: string, date: string) =>
  EmployeePlanModel.findOne({ employeeId, period: PLAN_PERIOD, periodStart: date }).lean() as Promise<IEmployeePlan | null>

/**
 * The repeating plan. An employee whose tasks were written per day, before the plan repeated, has
 * their latest day's tasks and notes taken over as the plan, once.
 */
async function loadPlan(employee: PlanOwner, today: string): Promise<{ tasks: IPlanTask[]; notes: string }> {
  if (employee.planStartedAt) return { tasks: employee.planItems ?? [], notes: employee.planNotes ?? "" }
  const latest = (await EmployeePlanModel.findOne({ employeeId: employee._id.toString(), period: PLAN_PERIOD, periodStart: { $lte: today }, "items.0": { $exists: true } })
    .sort({ periodStart: -1 })
    .lean()) as IEmployeePlan | null
  const tasks = (latest?.items ?? []).map(({ id, text }) => ({ id, text }))
  const notes = latest?.notes ?? ""
  await EmployeeModel.updateOne({ _id: employee._id, planStartedAt: null }, { $set: { planItems: tasks, planNotes: notes, planStartedAt: new Date() } })
  return { tasks, notes }
}

const sameTasks = (a: IPlanItem[], b: IPlanTask[]) => a.length === b.length && a.every((item, index) => item.id === b[index].id && item.text === b[index].text)

/**
 * Today's record, brought in line with the plan: the plan's tasks in the plan's order, each keeping
 * the tick it already had today. Written only when something differs, so an ordinary read never
 * rewrites the day (and never races a tick).
 */
async function syncToday(employee: PlanOwner, today: string): Promise<{ items: PlanItem[]; notes: string; updatedAt: string | null }> {
  const id = employee._id.toString()
  const [{ tasks, notes }, day] = await Promise.all([loadPlan(employee, today), findDay(id, today)])
  const ticks = new Map((day?.items ?? []).map((item) => [item.id, item]))
  const items: IPlanItem[] = tasks.map((task) => {
    const ticked = ticks.get(task.id)
    return {
      id: task.id,
      text: task.text,
      done: Boolean(ticked?.done),
      completedAt: ticked?.done ? (ticked.completedAt ?? null) : null,
      // Why it wasn't finished stays with the task through a change to the plan, like its tick
      reason: ticked?.done ? null : (ticked?.reason ?? null),
    }
  })
  let record = day
  if (!day || !sameTasks(day.items ?? [], tasks)) {
    const write = () =>
      EmployeePlanModel.findOneAndUpdate(
        { employeeId: id, period: PLAN_PERIOD, periodStart: today },
        { $set: { items }, $setOnInsert: { ownerId: employee.ownerId ?? null, employeeId: id, period: PLAN_PERIOD, periodStart: today, notes: "" } },
        { upsert: true, returnDocument: "after" }
      ).lean() as Promise<IEmployeePlan | null>
    // Two first reads of a new day at the same moment both try to create it; the second one updates instead
    record = await write().catch((error: unknown) => {
      if (error && typeof error === "object" && "code" in error && error.code === 11000) return write()
      throw error
    })
  }
  return { items: (record?.items ?? items).map(toItem), notes, updatedAt: record?.updatedAt ? new Date(record.updatedAt).toISOString() : null }
}

/**
 * The day the employee is working on. It is theirs, not the calendar's: it never turns over at
 * midnight, so someone still finishing their tasks at 1am keeps the same list in front of them, and
 * it moves on only when they start a new day from their link (startPublicNewDay). The first read
 * opens their first day on the day their browser is on.
 */
async function currentDay(employee: PlanOwner, today: string): Promise<string> {
  if (employee.planDay) return employee.planDay
  // `planDay: null` also matches an employee added before a day was their own to move on
  const opened = (await EmployeeModel.findOneAndUpdate(
    { _id: employee._id, planDay: null },
    { $set: { planDay: today } },
    { returnDocument: "after", projection: { planDay: 1 } }
  ).lean()) as { planDay?: string | null } | null
  // Null when another request opened their first day a moment earlier; that day is the one to use
  const day = opened?.planDay ?? ((await EmployeeModel.findById(employee._id, { planDay: 1 }).lean()) as { planDay?: string | null } | null)?.planDay ?? today
  employee.planDay = day
  return day
}

async function planOwner(viewer: Viewer, employeeId: string): Promise<PlanOwner | null> {
  const filter = visibleById(viewer, employeeId)
  if (!filter) return null
  await connectDatabase()
  return (await EmployeeModel.findOne(filter, PLAN_FIELDS).lean()) as unknown as PlanOwner | null
}

const toPlan = (employeeId: string, today: string, synced: Awaited<ReturnType<typeof syncToday>>): EmployeePlan => ({ employeeId, date: today, ...synced })

/**
 * The plan as it stands on the day the employee is working on: every task, that day's ticks and the
 * manager's notes. The day comes from the employee's own record, never from the clock, so the
 * manager sees the same day the employee has open on their link.
 */
export async function getPlan(viewer: Viewer, employeeId: string, today: string): Promise<EmployeePlan | null> {
  const employee = await planOwner(viewer, employeeId)
  if (!employee) return null
  const date = await currentDay(employee, today)
  return toPlan(employeeId, date, await syncToday(employee, date))
}

/**
 * Replaces the plan: its tasks (wording and order) and notes. It applies from today on; earlier days
 * keep the plan they had. Ticks are never taken from here, so the manager typing can't undo a tick
 * made from the employee's link. Blank tasks are dropped.
 */
export async function savePlan(viewer: Viewer, employeeId: string, input: EmployeePlanInput): Promise<EmployeePlan | null> {
  const employee = await planOwner(viewer, employeeId)
  if (!employee) return null
  const date = await currentDay(employee, input.today)
  const tasks = input.items.filter((item) => item.text.trim()).map((item) => ({ id: item.id, text: item.text.trim() }))
  await EmployeeModel.updateOne({ _id: employee._id }, { $set: { planItems: tasks, planNotes: input.notes, planStartedAt: employee.planStartedAt ?? new Date() } })
  return toPlan(employeeId, date, await syncToday({ ...employee, planItems: tasks, planNotes: input.notes, planStartedAt: employee.planStartedAt ?? new Date() }, date))
}

/**
 * Puts the plan's tasks in a new order (the manager's page). The order must name exactly the tasks the
 * plan has; otherwise the plan changed meanwhile and the caller is told to reload.
 */
async function reorder(employee: PlanOwner, today: string, order: string[]): Promise<Awaited<ReturnType<typeof syncToday>> | "changed"> {
  const { tasks } = await loadPlan(employee, today)
  const byId = new Map(tasks.map((task) => [task.id, task]))
  if (order.length !== tasks.length || !order.every((id) => byId.has(id))) return "changed"
  const reordered = order.map((id) => byId.get(id) as IPlanTask)
  // Only if the plan is still the one this order was made from
  const { modifiedCount, matchedCount } = await EmployeeModel.updateOne(
    { _id: employee._id, "planItems.id": { $all: order }, planItems: { $size: order.length } },
    { $set: { planItems: reordered, planStartedAt: employee.planStartedAt ?? new Date() } }
  )
  if (matchedCount === 0 && modifiedCount === 0) return "changed"
  return syncToday({ ...employee, planItems: reordered, planStartedAt: employee.planStartedAt ?? new Date() }, today)
}

export async function reorderPlan(viewer: Viewer, employeeId: string, today: string, order: string[]): Promise<EmployeePlan | null | "changed"> {
  const employee = await planOwner(viewer, employeeId)
  if (!employee) return null
  const date = await currentDay(employee, today)
  const result = await reorder(employee, date, order)
  return result === "changed" ? result : toPlan(employeeId, date, result)
}

/**
 * Ticks or unticks one of today's tasks, in one atomic update, recording when it was ticked.
 * Ticking a task that is already ticked keeps its first time. Null when the task isn't on the plan.
 */
const writeTick = (employeeId: string, date: string, itemId: string, done: boolean) =>
  EmployeePlanModel.updateOne(
    { employeeId, period: PLAN_PERIOD, periodStart: date, items: { $elemMatch: { id: itemId, done: !done } } } as Record<string, unknown>,
    // Ticking a task off clears why it wasn't finished, since it now is
    { $set: { "items.$.done": done, "items.$.completedAt": done ? new Date() : null, ...(done ? { "items.$.reason": null } : {}) } }
  )

/**
 * Writes why a task wasn't finished, on the day it belongs to. An empty reason removes the one that
 * was there, so the employee can take it back. A task already ticked off keeps no reason.
 */
const writeReason = (employeeId: string, date: string, itemId: string, reason: string) =>
  EmployeePlanModel.updateOne(
    { employeeId, period: PLAN_PERIOD, periodStart: date, items: { $elemMatch: { id: itemId, done: false } } } as Record<string, unknown>,
    { $set: { "items.$.reason": reason || null } }
  )

async function tick(employee: PlanOwner, today: string, itemId: string, done: boolean) {
  const id = employee._id.toString()
  await syncToday(employee, today)
  await writeTick(id, today, itemId, done)
  const synced = await syncToday(employee, today)
  return synced.items.some((item) => item.id === itemId) ? synced : null
}

/**
 * Ticks or unticks a task on a day that is already in the history. A day gone by keeps the tasks it
 * had, so nothing is brought in line with the plan here: only that one tick changes. This is what
 * lets a task finished after the day was closed still be ticked off where it belongs.
 */
async function tickHistoryDay(employeeId: string, date: string, itemId: string, done: boolean): Promise<PlanHistoryDay | null> {
  await writeTick(employeeId, date, itemId, done)
  const record = await findDay(employeeId, date)
  if (!record || !(record.items ?? []).some((item) => item.id === itemId)) return null
  return toHistoryDay(record)
}

export async function tickPlanItem(viewer: Viewer, employeeId: string, today: string, itemId: string, done: boolean): Promise<EmployeePlan | null> {
  const employee = await planOwner(viewer, employeeId)
  if (!employee) return null
  const date = await currentDay(employee, today)
  const synced = await tick(employee, date, itemId, done)
  return synced ? toPlan(employeeId, date, synced) : null
}

/** The same tick, on a day in the employee's history (the manager's page can fix a missed one too). */
export async function tickPlanHistoryItem(viewer: Viewer, employeeId: string, date: string, itemId: string, done: boolean): Promise<PlanHistoryDay | null> {
  const employee = await planOwner(viewer, employeeId)
  return employee ? tickHistoryDay(employeeId, date, itemId, done) : null
}

/**
 * Past days, newest first, before `before`, PLAN_HISTORY_DAYS at a time. Each is the record of that
 * day: the tasks the plan had then, which were ticked and when.
 */
async function historyBefore(employeeId: string, before: string): Promise<PlanHistoryPage> {
  const records = (await EmployeePlanModel.find({ employeeId, period: PLAN_PERIOD, periodStart: { $lt: before }, "items.0": { $exists: true } })
    .sort({ periodStart: -1 })
    .limit(PLAN_HISTORY_DAYS + 1)
    .lean()) as IEmployeePlan[]
  const days = records.slice(0, PLAN_HISTORY_DAYS).map(toHistoryDay)
  return { days, nextBefore: records.length > PLAN_HISTORY_DAYS && days.length > 0 ? days[days.length - 1].date : null }
}

export async function getPlanHistory(viewer: Viewer, employeeId: string, before: string): Promise<PlanHistoryPage | null> {
  const employee = await planOwner(viewer, employeeId)
  return employee ? historyBefore(employeeId, before) : null
}

// --- The employee's own link ---------------------------------------------------------------------

type LinkedEmployee = PlanOwner & Pick<StoredEmployee, "name" | "role" | "linkOrder">

/**
 * Today's tasks in the order the employee arranged them on their link. A task the manager added
 * since goes right after the task it follows in the plan (or first, when nothing before it is
 * placed); a task the manager removed simply drops out.
 */
function inLinkOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  if (order.length === 0) return items
  const byId = new Map(items.map((item) => [item.id, item]))
  const result = order.filter((id) => byId.has(id)).map((id) => byId.get(id) as T)
  const placed = new Set(result.map((item) => item.id))
  items.forEach((item, index) => {
    if (placed.has(item.id)) return
    const before = items.slice(0, index).reverse().find((earlier) => placed.has(earlier.id))
    result.splice(before ? result.findIndex((entry) => entry.id === before.id) + 1 : 0, 0, item)
    placed.add(item.id)
  })
  return result
}

const linkToday = (employee: LinkedEmployee, today: string, items: PlanItem[]): PublicPlan["today"] => ({
  date: today,
  items: inLinkOrder(items, employee.linkOrder ?? []),
  ownOrder: (employee.linkOrder ?? []).length > 0,
})

/**
 * The employee a link opens, or null when the token is malformed, its signature is wrong or out of
 * date, the link is off, or the employee is inactive. Every one of those reads the same to the page.
 */
async function findEmployeeByPlanLink(token: string): Promise<LinkedEmployee | null> {
  const read = readPlanLinkToken(token)
  if (!read) return null
  await connectDatabase()
  const record = (await EmployeeModel.findById(read.employeeId, PLAN_FIELDS).lean()) as unknown as (LinkedEmployee & Pick<StoredEmployee, "planLinkActive" | "planLinkVersion" | "status">) | null
  if (!record || !record.planLinkActive || record.status !== "active" || !planLinkMatches(read, record.planLinkVersion ?? 0)) return null
  return record
}

/**
 * What the link shows: the employee's name and role, the tasks of the day they are working on, and
 * the days before it. Never the notes. The day is the one on their record, not the one the clock is
 * on, so a day they are still working through stays in front of them past midnight.
 */
export async function getPublicPlan(token: string, today: string): Promise<PublicPlan | null> {
  const employee = await findEmployeeByPlanLink(token)
  if (!employee) return null
  const date = await currentDay(employee, today)
  const [synced, history] = await Promise.all([syncToday(employee, date), historyBefore(employee._id.toString(), date)])
  return { employee: { name: employee.name, role: employee.role }, today: linkToday(employee, date, synced.items), history }
}

export async function getPublicHistory(token: string, before: string): Promise<PlanHistoryPage | null> {
  const employee = await findEmployeeByPlanLink(token)
  return employee ? historyBefore(employee._id.toString(), before) : null
}

/**
 * Saves why one of the day's tasks wasn't finished, from the link. An empty reason removes it.
 * Only the employee writes these; the manager reads them on their page and in the history.
 */
export async function savePublicItemReason(token: string, today: string, itemId: string, reason: string): Promise<PublicPlan["today"] | null | "no-item"> {
  const employee = await findEmployeeByPlanLink(token)
  if (!employee) return null
  const date = await currentDay(employee, today)
  await syncToday(employee, date)
  await writeReason(employee._id.toString(), date, itemId, reason)
  const synced = await syncToday(employee, date)
  return synced.items.some((item) => item.id === itemId) ? linkToday(employee, date, synced.items) : "no-item"
}

/** The same reason, on a day already in the history, which stays open for both ticks and reasons. */
export async function savePublicHistoryItemReason(token: string, date: string, itemId: string, reason: string): Promise<PlanHistoryDay | null | "no-item"> {
  const employee = await findEmployeeByPlanLink(token)
  if (!employee) return null
  await writeReason(employee._id.toString(), date, itemId, reason)
  const record = await findDay(employee._id.toString(), date)
  if (!record || !(record.items ?? []).some((item) => item.id === itemId)) return "no-item"
  return toHistoryDay(record)
}

/** Ticks or unticks one of the day's tasks from the link. No task can be added, reworded or removed from here. */
export async function tickPublicItem(token: string, today: string, itemId: string, done: boolean): Promise<PublicPlan["today"] | null | "no-item"> {
  const employee = await findEmployeeByPlanLink(token)
  if (!employee) return null
  const date = await currentDay(employee, today)
  const synced = await tick(employee, date, itemId, done)
  return synced ? linkToday(employee, date, synced.items) : "no-item"
}

/**
 * The same tick, on a day already in the history. It is never disabled: a task finished after its
 * day was closed can still be ticked off where it belongs, and one ticked by mistake unticked.
 */
export async function tickPublicHistoryItem(token: string, date: string, itemId: string, done: boolean): Promise<PlanHistoryDay | null | "no-item"> {
  const employee = await findEmployeeByPlanLink(token)
  if (!employee) return null
  const day = await tickHistoryDay(employee._id.toString(), date, itemId, done)
  return day ?? "no-item"
}

/**
 * Moves tasks up and down from the link, for the employee's own view only: it stays through a
 * refresh and on later days, but the plan's order, which the manager sees and sets, never changes.
 * The order must name exactly today's tasks; otherwise the plan changed meanwhile.
 */
export async function reorderPublicPlan(token: string, today: string, order: string[]): Promise<PublicPlan["today"] | null | "changed"> {
  const employee = await findEmployeeByPlanLink(token)
  if (!employee) return null
  const date = await currentDay(employee, today)
  const synced = await syncToday(employee, date)
  const ids = new Set(synced.items.map((item) => item.id))
  if (order.length !== ids.size || !order.every((id) => ids.has(id))) return "changed"
  await EmployeeModel.updateOne({ _id: employee._id }, { $set: { linkOrder: order } })
  return linkToday({ ...employee, linkOrder: order }, date, synced.items)
}

/**
 * Clears every tick on today's record (the tasks stay) and puts the tasks back in the plan's order,
 * the one the manager set. Earlier days are never touched, so the history keeps what was finished on them.
 */
export async function resetPublicDay(token: string, today: string): Promise<PublicPlan["today"] | null> {
  const employee = await findEmployeeByPlanLink(token)
  if (!employee) return null
  const date = await currentDay(employee, today)
  await syncToday(employee, date)
  await Promise.all([
    EmployeePlanModel.updateOne(
      { employeeId: employee._id.toString(), period: PLAN_PERIOD, periodStart: date },
      { $set: { "items.$[].done": false, "items.$[].completedAt": null } }
    ),
    EmployeeModel.updateOne({ _id: employee._id }, { $set: { linkOrder: [] } }),
  ])
  return linkToday({ ...employee, linkOrder: [] }, date, (await syncToday(employee, date)).items)
}

/**
 * Cancels the day the employee is on and goes back to the day before it, which is how a new day
 * started by mistake is undone. **The day being cancelled is deleted**, ticks and all, and the day
 * before it comes back out of the history as the day being worked on, keeping its own ticks; from
 * then on it follows the plan again, like any day being worked on. The first day can't be cancelled,
 * because there is nothing behind it.
 */
export async function cancelPublicDay(token: string, today: string): Promise<PublicPlan["today"] | null | "no-previous"> {
  const employee = await findEmployeeByPlanLink(token)
  if (!employee) return null
  const date = await currentDay(employee, today)
  const previous = (await EmployeePlanModel.findOne({
    employeeId: employee._id.toString(),
    period: PLAN_PERIOD,
    periodStart: { $lt: date },
    "items.0": { $exists: true },
  })
    .sort({ periodStart: -1 })
    .lean()) as IEmployeePlan | null
  // A day started by mistake can be undone; the very first day is theirs to work on, not to cancel
  if (!previous) return "no-previous"
  await EmployeePlanModel.deleteOne({ employeeId: employee._id.toString(), period: PLAN_PERIOD, periodStart: date })
  await EmployeeModel.updateOne({ _id: employee._id }, { $set: { planDay: previous.periodStart } })
  employee.planDay = previous.periodStart
  return linkToday(employee, previous.periodStart, (await syncToday(employee, previous.periodStart)).items)
}

/**
 * Finishes the day the employee is on and opens the next one. **This is the only thing that moves
 * their day on**: nothing rolls over at midnight, so working past twelve keeps the same list until
 * they say they are done with it. The day they just finished goes into the history, where its tasks
 * stay tickable, and the new day starts from the plan with nothing ticked.
 *
 * The new day is the day their browser is on, or the day after the one they finished when the
 * calendar has not caught up yet (someone finishing at 11pm opens tomorrow). A day already ahead of
 * the calendar is the one to work on, so there is nothing to start.
 */
export async function startPublicNewDay(token: string, today: string): Promise<PublicPlan["today"] | null | "already-open"> {
  const employee = await findEmployeeByPlanLink(token)
  if (!employee) return null
  const finished = await currentDay(employee, today)
  if (finished > today) return "already-open"
  const next = today > finished ? today : shiftDate(finished, 1)
  await EmployeeModel.updateOne({ _id: employee._id }, { $set: { planDay: next } })
  employee.planDay = next
  return linkToday(employee, next, (await syncToday(employee, next)).items)
}
