import { connectDatabase } from "@/lib/db"
import { allOf, searchCondition } from "@/lib/listQuery"
import { planLinkMatches, planLinkToken, readPlanLinkToken } from "@/lib/planLink"
import { EmployeeModel, EmployeePlanModel, type IEmployee, type IEmployeePlan, type IPlanItem, type IPlanTask } from "@/models/Employee"
import { EMPLOYEES_LIST_MAX, PLAN_HISTORY_DAYS, PLAN_PERIOD, type EmployeeStatus } from "@/constants/employees"
import type {
  Employee,
  EmployeeInput,
  EmployeePlan,
  EmployeePlanInput,
  EmployeesPage,
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

type PlanOwner = Pick<StoredEmployee, "_id" | "ownerId" | "planItems" | "planNotes" | "planStartedAt">

const PLAN_FIELDS = { ownerId: 1, planItems: 1, planNotes: 1, planStartedAt: 1, linkOrder: 1, planLinkActive: 1, planLinkVersion: 1, status: 1, name: 1, role: 1 } as const

const toItem = (item: IPlanItem): PlanItem => ({
  id: item.id,
  text: item.text,
  done: Boolean(item.done),
  completedAt: item.done && item.completedAt ? new Date(item.completedAt).toISOString() : null,
})

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
    return { id: task.id, text: task.text, done: Boolean(ticked?.done), completedAt: ticked?.done ? (ticked.completedAt ?? null) : null }
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

async function planOwner(viewer: Viewer, employeeId: string): Promise<PlanOwner | null> {
  const filter = visibleById(viewer, employeeId)
  if (!filter) return null
  await connectDatabase()
  return (await EmployeeModel.findOne(filter, PLAN_FIELDS).lean()) as unknown as PlanOwner | null
}

const toPlan = (employeeId: string, today: string, synced: Awaited<ReturnType<typeof syncToday>>): EmployeePlan => ({ employeeId, date: today, ...synced })

/** The plan as it stands today: every task, today's ticks and the manager's notes. */
export async function getPlan(viewer: Viewer, employeeId: string, today: string): Promise<EmployeePlan | null> {
  const employee = await planOwner(viewer, employeeId)
  return employee ? toPlan(employeeId, today, await syncToday(employee, today)) : null
}

/**
 * Replaces the plan: its tasks (wording and order) and notes. It applies from today on; earlier days
 * keep the plan they had. Ticks are never taken from here, so the manager typing can't undo a tick
 * made from the employee's link. Blank tasks are dropped.
 */
export async function savePlan(viewer: Viewer, employeeId: string, input: EmployeePlanInput): Promise<EmployeePlan | null> {
  const employee = await planOwner(viewer, employeeId)
  if (!employee) return null
  const tasks = input.items.filter((item) => item.text.trim()).map((item) => ({ id: item.id, text: item.text.trim() }))
  await EmployeeModel.updateOne({ _id: employee._id }, { $set: { planItems: tasks, planNotes: input.notes, planStartedAt: employee.planStartedAt ?? new Date() } })
  return toPlan(employeeId, input.today, await syncToday({ ...employee, planItems: tasks, planNotes: input.notes, planStartedAt: employee.planStartedAt ?? new Date() }, input.today))
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
  const result = await reorder(employee, today, order)
  return result === "changed" ? result : toPlan(employeeId, today, result)
}

/**
 * Ticks or unticks one of today's tasks, in one atomic update, recording when it was ticked.
 * Ticking a task that is already ticked keeps its first time. Null when the task isn't on the plan.
 */
async function tick(employee: PlanOwner, today: string, itemId: string, done: boolean) {
  const id = employee._id.toString()
  await syncToday(employee, today)
  await EmployeePlanModel.updateOne(
    { employeeId: id, period: PLAN_PERIOD, periodStart: today, items: { $elemMatch: { id: itemId, done: !done } } } as Record<string, unknown>,
    { $set: { "items.$.done": done, "items.$.completedAt": done ? new Date() : null } }
  )
  const synced = await syncToday(employee, today)
  return synced.items.some((item) => item.id === itemId) ? synced : null
}

export async function tickPlanItem(viewer: Viewer, employeeId: string, today: string, itemId: string, done: boolean): Promise<EmployeePlan | null> {
  const employee = await planOwner(viewer, employeeId)
  if (!employee) return null
  const synced = await tick(employee, today, itemId, done)
  return synced ? toPlan(employeeId, today, synced) : null
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
  const days = records.slice(0, PLAN_HISTORY_DAYS).map((record) => {
    const items = record.items.map(toItem)
    return { date: record.periodStart, items, doneCount: items.filter((item) => item.done).length }
  })
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

/** What the link shows: the employee's name and role, today's tasks and the history before today. Never the notes. */
export async function getPublicPlan(token: string, today: string): Promise<PublicPlan | null> {
  const employee = await findEmployeeByPlanLink(token)
  if (!employee) return null
  const [synced, history] = await Promise.all([syncToday(employee, today), historyBefore(employee._id.toString(), today)])
  return { employee: { name: employee.name, role: employee.role }, today: linkToday(employee, today, synced.items), history }
}

export async function getPublicHistory(token: string, before: string): Promise<PlanHistoryPage | null> {
  const employee = await findEmployeeByPlanLink(token)
  return employee ? historyBefore(employee._id.toString(), before) : null
}

/** Ticks or unticks one of today's tasks from the link. No task can be added, reworded or removed from here. */
export async function tickPublicItem(token: string, today: string, itemId: string, done: boolean): Promise<PublicPlan["today"] | null | "no-item"> {
  const employee = await findEmployeeByPlanLink(token)
  if (!employee) return null
  const synced = await tick(employee, today, itemId, done)
  return synced ? linkToday(employee, today, synced.items) : "no-item"
}

/**
 * Moves tasks up and down from the link, for the employee's own view only: it stays through a
 * refresh and on later days, but the plan's order, which the manager sees and sets, never changes.
 * The order must name exactly today's tasks; otherwise the plan changed meanwhile.
 */
export async function reorderPublicPlan(token: string, today: string, order: string[]): Promise<PublicPlan["today"] | null | "changed"> {
  const employee = await findEmployeeByPlanLink(token)
  if (!employee) return null
  const synced = await syncToday(employee, today)
  const ids = new Set(synced.items.map((item) => item.id))
  if (order.length !== ids.size || !order.every((id) => ids.has(id))) return "changed"
  await EmployeeModel.updateOne({ _id: employee._id }, { $set: { linkOrder: order } })
  return linkToday({ ...employee, linkOrder: order }, today, synced.items)
}

/**
 * Clears every tick on today's record (the tasks stay) and puts the tasks back in the plan's order,
 * the one the manager set. Earlier days are never touched, so the history keeps what was finished on them.
 */
export async function resetPublicDay(token: string, today: string): Promise<PublicPlan["today"] | null> {
  const employee = await findEmployeeByPlanLink(token)
  if (!employee) return null
  await syncToday(employee, today)
  await Promise.all([
    EmployeePlanModel.updateOne(
      { employeeId: employee._id.toString(), period: PLAN_PERIOD, periodStart: today },
      { $set: { "items.$[].done": false, "items.$[].completedAt": null } }
    ),
    EmployeeModel.updateOne({ _id: employee._id }, { $set: { linkOrder: [] } }),
  ])
  return linkToday({ ...employee, linkOrder: [] }, today, (await syncToday(employee, today)).items)
}
