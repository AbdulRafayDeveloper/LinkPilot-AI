"use client"

import { useCallback, useState } from "react"
import { useSavedFilters } from "@/hooks/useSavedFilters"
import { PRIORITY_IDS, type Priority } from "@/constants/priorities"
import { TASK_DOER_IDS, type TaskDoer } from "@/constants/taskDoers"
import { NOTHING_NARROWED, type TaskNarrowing, type YesOrNo } from "@/lib/taskFilters"
import { filtersOf, oneOf, type SavedFilters } from "@/lib/savedFilters"

/**
 * What Daily Tasks is narrowed to, kept on the account like every other page's filters
 * (`hooks/useSavedFilters.ts`): a filter put on is still on after a reload, after signing out and
 * in, and on another machine, until it is changed.
 *
 * Daily Tasks is the one page that narrows the days it already holds rather than asking the server
 * for a narrower list, because a day's tasks come down in one answer anyway; that is why it keeps
 * the narrowing in its own shape here while the keeping itself is the shared one.
 *
 * **A value the list cannot offer is read as off** (`oneOf`), so a filter saved by an older version
 * of this page, or by anything that went round the app, can never hide every task with no way to
 * put it right.
 */

const asNarrowing = (saved: SavedFilters): TaskNarrowing => ({
  priority: oneOf<Priority>(saved.priority, PRIORITY_IDS),
  doer: oneOf<TaskDoer>(saved.doer, TASK_DOER_IDS),
  blocked: oneOf<YesOrNo>(saved.blocked, ["yes", "no"]),
  done: oneOf<YesOrNo>(saved.done, ["yes", "no"]),
})

export function useTaskFilters(): {
  narrowing: TaskNarrowing
  setNarrowing: (next: TaskNarrowing) => void
  error: string | null
} {
  const [narrowing, setNarrowing] = useState<TaskNarrowing>(NOTHING_NARROWED)
  const [error, setError] = useState<string | null>(null)

  useSavedFilters({
    view: "daily-tasks",
    filters: filtersOf(narrowing),
    apply: (saved: SavedFilters) => setNarrowing(asNarrowing(saved)),
    onSaveFailed: setError,
  })

  const change = useCallback((next: TaskNarrowing) => {
    setError(null)
    setNarrowing(next)
  }, [])

  return { narrowing, setNarrowing: change, error }
}
