/**
 * One task, as the API serves it and the list shows it.
 */
export interface DailyTask {
  id: string
  content: string
  // The calendar day the task belongs to (YYYY-MM-DD)
  taskDate: string
  isCompleted: boolean
  completedAt: string | null
}

/**
 * One day of tasks, in the order they were written.
 */
export interface DailyTaskDay {
  date: string
  tasks: DailyTask[]
}

/**
 * One page of the list, newest day first. Page 1 is the default view: today and the six days
 * before it. Later pages are older days, `HISTORY_DAYS_PER_PAGE` days at a time, so the whole
 * history is reachable without ever loading it all.
 */
export interface DailyTasksPage {
  days: DailyTaskDay[]
  page: number
  pageCount: number
  // The oldest day page 1 shows, so the UI can say what "the last seven days" means
  windowStart: string
  // Tasks still open on a day before today, however far back
  overdueCount: number
  // Tasks older than the seven-day window: what the cleanup action would delete
  olderTaskCount: number
}
