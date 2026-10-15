/**
 * Who does a task: the user themselves, or an employee they get it done by.
 *
 * Two, not more, because that is the whole question the owner asked it to answer ("is this mine to
 * do, or am I getting it done?"). Anyone in particular is the Employees module's business; here it
 * is only which of the two piles a line belongs in, so one word on the row says it.
 *
 * **Me is the default, and it is what a task saved before this reads as**, so every task always has
 * one, the control never opens on an empty state, and an older record is never a special case. It
 * mirrors `constants/priorities.ts` exactly, which is what makes the row's two chips behave alike.
 */
export const TASK_DOERS = [
  { id: "me", label: "Me", description: "I do this one" },
  { id: "employee", label: "Employee", description: "An employee does it for me" },
] as const

export type TaskDoer = (typeof TASK_DOERS)[number]["id"]

export const TASK_DOER_IDS = TASK_DOERS.map((doer) => doer.id) as [TaskDoer, ...TaskDoer[]]

export const DEFAULT_TASK_DOER: TaskDoer = "me"

/** One of the two by its id, falling back to the default, which is what anything older reads as. */
export const doerOf = (id: string | null | undefined) =>
  TASK_DOERS.find((doer) => doer.id === id) ?? TASK_DOERS.find((doer) => doer.id === DEFAULT_TASK_DOER)!

/** The colour each is shown in. The word is always there, so this only ever helps. */
export const TASK_DOER_TONE: Record<TaskDoer, string> = {
  me: "bg-primary-fixed text-on-primary-fixed-variant",
  employee: "bg-surface-container-high text-on-surface-variant",
}

/** What the control decides, for a screen reader, since it carries no words of its own. */
export const doerLabel = (name: string) => `Who does ${name}`
