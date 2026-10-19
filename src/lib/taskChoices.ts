import { DEFAULT_PRIORITY, type Priority } from "@/constants/priorities"
import { DEFAULT_TASK_DOER, type TaskDoer } from "@/constants/taskDoers"

/**
 * Everything a daily task carries besides its own words: how urgent it is, who does it, whether
 * anything is holding it up, and whether it comes back every day.
 *
 * It is one shape so the **same four choices are offered wherever a task is written or read** (the
 * Add task popup, the row that adds one more task to a day, the field that adds a subtask, and
 * every row of the list), and it lives here rather than with the control that draws them
 * (`components/daily-tasks/TaskOptions.tsx`) so the rules can be read and tested on their own.
 */
export interface TaskChoices {
  priority: Priority
  doer: TaskDoer
  isBlocked: boolean
  repeats: boolean
}

/** What a task starts as: the usual urgency, the user's own, nothing holding it up, once only. */
export const defaultChoices = (): TaskChoices => ({
  priority: DEFAULT_PRIORITY,
  doer: DEFAULT_TASK_DOER,
  isBlocked: false,
  repeats: false,
})

/**
 * Whether nothing here was chosen. A task that says nothing is still written as the plain line it
 * always was, so every caller from before these existed sends exactly what it used to.
 */
export const isPlain = (choices: TaskChoices): boolean =>
  choices.priority === DEFAULT_PRIORITY && choices.doer === DEFAULT_TASK_DOER && !choices.isBlocked && !choices.repeats
