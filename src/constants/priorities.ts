/**
 * How urgent something is: **High, Medium or Low**, shared by every module that ranks its work.
 *
 * It is one of three rather than a number, because what a list needs from it is "which of these do
 * we do first", and the word is always shown, so it never rests on colour alone.
 *
 * **Medium is the default, and it is what anything saved before priorities reads as**: that way
 * everything has one, the picker always has something to change rather than an empty state, and a
 * record written by an older version of the app is never a special case.
 *
 * It was Client Projects' own (`PROJECT_PRIORITIES`) until Daily Tasks wanted the same three words.
 * Rather than a second list that could drift, the words, the colours and the fallback live here and
 * `constants/clientProjectTasks.ts` re-exports them under the names it already used, so every
 * client-projects caller is untouched.
 */
export const PRIORITIES = [
  { id: "high", label: "High", short: "High", description: "Do this first" },
  { id: "medium", label: "Medium", short: "Med", description: "The usual" },
  { id: "low", label: "Low", short: "Low", description: "When there is room" },
] as const

export type Priority = (typeof PRIORITIES)[number]["id"]

export const PRIORITY_IDS = PRIORITIES.map((priority) => priority.id) as [Priority, ...Priority[]]

export const DEFAULT_PRIORITY: Priority = "medium"

/** One priority by its id, falling back to the default, which is what anything older reads as. */
export const priorityOf = (id: string | null | undefined) =>
  PRIORITIES.find((priority) => priority.id === id) ?? PRIORITIES.find((priority) => priority.id === DEFAULT_PRIORITY)!

/** The colour each one is shown in. The word is always there, so this only ever helps. */
export const PRIORITY_TONE: Record<Priority, string> = {
  high: "bg-error-container text-error",
  medium: "bg-secondary-fixed text-on-secondary-fixed-variant",
  low: "bg-surface-container-high text-outline",
}

/** What the control is the priority of, for a screen reader, since it carries no words of its own. */
export const priorityLabel = (name: string) => `How urgent ${name} is`
