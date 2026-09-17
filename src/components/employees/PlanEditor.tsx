"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { AlertCircle, Check, Loader2, Plus, Repeat, RefreshCw, Trash2 } from "lucide-react"
import { SortableList } from "@/components/ui/SortableList"
import { fetchWithRetry, requestApi } from "@/lib/apiClient"
import { todayIso } from "@/lib/taskDates"
import { EMPLOYEES_ENDPOINT, EMPLOYEE_MESSAGES, PLAN_ITEM_MAX_LENGTH, PLAN_MAX_ITEMS, PLAN_NOTES_MAX_LENGTH, PLAN_SAVE_DELAY_MS } from "@/constants/employees"
import type { Employee, EmployeePlan, EmployeePlanInput, PlanHistoryPage, PlanItem } from "@/types/employees"
import { PlanHistory, dayHeading, mergeHistory, tickTime } from "./PlanHistory"

const newItemId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `item-${Date.now()}-${Math.round(Math.random() * 1e6)}`)

type SaveState = "saved" | "pending" | "saving" | "failed"

interface Draft {
  // Which employee and day this is, so a late answer for another one is never applied
  key: string
  items: PlanItem[]
  notes: string
  updatedAt: string | null
  // Bumped on every edit, so a save that finishes after a newer edit doesn't mark it saved
  version: number
}

const planUrl = (employeeId: string) => `${EMPLOYEES_ENDPOINT}/${employeeId}/plans`
const toInput = (today: string, draft: Pick<Draft, "items" | "notes">): EmployeePlanInput => ({
  today,
  items: draft.items.map(({ id, text }) => ({ id, text })),
  notes: draft.notes,
})
const getId = (item: PlanItem) => item.id
const getLabel = (item: PlanItem) => item.text || "empty task"

/**
 * One employee's daily plan: **one** list of tasks that repeats every day. Add a task with Enter,
 * reword it in place, drag it up or down, remove it; the change applies from today on and saves
 * itself once typing settles. Ticks belong to today: each is saved on its own, straight away, with
 * the time it was ticked, and tomorrow starts from the same tasks with nothing ticked. Earlier days,
 * with what was finished on them, are in the history underneath.
 */
export const PlanEditor: React.FC<{ employee: Employee }> = ({ employee }) => {
  const [today, setToday] = useState(todayIso)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [loadError, setLoadError] = useState<{ key: string; message: string } | null>(null)
  const [saveState, setSaveState] = useState<SaveState>("saved")
  const [tickError, setTickError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [newItem, setNewItem] = useState("")
  const [history, setHistory] = useState<PlanHistoryPage | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const key = `${employee.id}|${today}`
  const pendingRef = useRef<{ employeeId: string; body: EmployeePlanInput } | null>(null)
  const isLoaded = draft?.key === key

  // Load the plan (and, with it, today's ticks) whenever the employee or the day changes
  useEffect(() => {
    const controller = new AbortController()
    const [employeeId, day] = key.split("|")
    requestApi<EmployeePlan>(`${planUrl(employeeId)}?today=${day}`, { signal: controller.signal })
      .then(({ data }) => {
        setDraft({ key, items: data.items, notes: data.notes, updatedAt: data.updatedAt, version: 0 })
        setSaveState("saved")
        setLoadError(null)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setLoadError({ key, message: reason instanceof Error ? reason.message : EMPLOYEE_MESSAGES.planLoadFailed })
      })
    return () => controller.abort()
  }, [key, attempt])

  // The days before today
  useEffect(() => {
    const controller = new AbortController()
    requestApi<PlanHistoryPage>(`${planUrl(employee.id)}/history?before=${today}`, { signal: controller.signal })
      .then(({ data }) => {
        setHistory(data)
        setHistoryError(null)
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setHistoryError(reason instanceof Error ? reason.message : EMPLOYEE_MESSAGES.historyFailed)
      })
    return () => controller.abort()
  }, [employee.id, today, attempt])

  // Coming back to the tab picks up a new day, and the employee's ticks and moves, unless an edit is waiting
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible" || pendingRef.current) return
      if (todayIso() !== today) setToday(todayIso())
      else setAttempt((count) => count + 1)
    }
    document.addEventListener("visibilitychange", refresh)
    return () => document.removeEventListener("visibilitychange", refresh)
  }, [today])

  const loadOlderHistory = async (before: string) => {
    setIsLoadingHistory(true)
    try {
      const { data } = await requestApi<PlanHistoryPage>(`${planUrl(employee.id)}/history?before=${before}`)
      setHistory((current) => mergeHistory(current, data))
      setHistoryError(null)
    } catch (reason: unknown) {
      setHistoryError(reason instanceof Error ? reason.message : EMPLOYEE_MESSAGES.historyFailed)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const save = useCallback(async (payload: { employeeId: string; body: EmployeePlanInput }, planKey: string, version: number) => {
    setSaveState("saving")
    try {
      const { data } = await requestApi<EmployeePlan>(planUrl(payload.employeeId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.body),
      })
      setDraft((latest) => {
        if (!latest || latest.key !== planKey) return latest
        if (latest.version === version) pendingRef.current = null
        // Ticks come from the server, which may hold a tick made meanwhile from the employee's link
        const ticks = new Map(data.items.map((item) => [item.id, item]))
        const items = latest.items.map((item) => {
          const saved = ticks.get(item.id)
          return saved ? { ...item, done: saved.done, completedAt: saved.completedAt } : item
        })
        return { ...latest, items, updatedAt: data.updatedAt }
      })
      setSaveState((state) => (pendingRef.current ? state : "saved"))
    } catch {
      setSaveState("failed")
    }
  }, [])

  // Save once typing (or dragging) settles
  useEffect(() => {
    if (!draft || draft.version === 0 || !pendingRef.current) return
    const payload = pendingRef.current
    const timer = setTimeout(() => void save(payload, draft.key, draft.version), PLAN_SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [draft, save])

  // A change still waiting when the employee changes (or the page closes) is saved on the way out
  useEffect(() => {
    const flush = () => {
      const payload = pendingRef.current
      if (!payload) return
      pendingRef.current = null
      void fetchWithRetry(planUrl(payload.employeeId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.body),
        keepalive: true,
      }).catch(() => undefined)
    }
    window.addEventListener("pagehide", flush)
    return () => {
      window.removeEventListener("pagehide", flush)
      flush()
    }
  }, [key])

  const edit = (change: (draft: Draft) => Pick<Draft, "items" | "notes">) => {
    setDraft((latest) => {
      if (!latest || latest.key !== key) return latest
      const next = { ...latest, ...change(latest), version: latest.version + 1 }
      pendingRef.current = { employeeId: employee.id, body: toInput(today, next) }
      return next
    })
    setSaveState("pending")
  }

  /**
   * A tick goes straight to the server. A task added a moment ago may not be saved yet, so the plan is
   * saved first; the tick shows at once and is put back if it can't be saved.
   */
  const tick = async (item: PlanItem, done: boolean) => {
    const planKey = key
    const setLocal = (value: boolean, completedAt: string | null) =>
      setDraft((latest) =>
        latest && latest.key === planKey ? { ...latest, items: latest.items.map((entry) => (entry.id === item.id ? { ...entry, done: value, completedAt } : entry)) } : latest
      )
    setLocal(done, done ? new Date().toISOString() : null)
    setTickError(null)
    try {
      const pending = pendingRef.current
      if (pending) {
        pendingRef.current = null
        await requestApi<EmployeePlan>(planUrl(pending.employeeId), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pending.body) })
      }
      const { data } = await requestApi<EmployeePlan>(planUrl(employee.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ today, itemId: item.id, done }),
      })
      const saved = data.items.find((entry) => entry.id === item.id)
      if (saved) setLocal(saved.done, saved.completedAt)
    } catch (reason: unknown) {
      setLocal(item.done, item.completedAt)
      setTickError(reason instanceof Error ? reason.message : EMPLOYEE_MESSAGES.tickFailed)
    }
  }

  const addItem = () => {
    const text = newItem.trim()
    if (!text || !draft || draft.items.length >= PLAN_MAX_ITEMS) return
    edit((latest) => ({ items: [...latest.items, { id: newItemId(), text, done: false, completedAt: null }], notes: latest.notes }))
    setNewItem("")
  }

  const reorder = (ids: string[]) =>
    edit((latest) => {
      const byId = new Map(latest.items.map((entry) => [entry.id, entry]))
      return { items: ids.map((id) => byId.get(id)).filter((entry): entry is PlanItem => Boolean(entry)), notes: latest.notes }
    })

  const items = isLoaded ? draft.items : []
  const doneCount = items.filter((item) => item.done).length
  const failed = loadError?.key === key ? loadError.message : null

  return (
    <section aria-label={`${employee.name}'s plans`} className="flex flex-col gap-4 rounded-2xl border border-outline-variant bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-bold text-on-surface">Daily plan</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-on-surface-variant">
            <Repeat size={13} className="text-primary" aria-hidden="true" />
            Repeats every day. Ticks start fresh each morning; earlier days stay in the history.
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-[12px] text-outline" aria-live="polite">
          {saveState === "saving" || saveState === "pending" ? (
            <>
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              Saving...
            </>
          ) : saveState === "failed" ? (
            <button
              type="button"
              onClick={() => pendingRef.current && draft && void save(pendingRef.current, draft.key, draft.version)}
              className="flex items-center gap-1 font-semibold text-error hover:underline"
            >
              <RefreshCw size={13} aria-hidden="true" />
              Couldn&apos;t save. Retry
            </button>
          ) : isLoaded && draft.updatedAt ? (
            <>
              <Check size={13} className="text-success" aria-hidden="true" />
              Saved
            </>
          ) : null}
        </span>
      </div>

      {failed ? (
        <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="flex items-center gap-2 text-sm text-error">
            <AlertCircle size={16} aria-hidden="true" />
            {failed}
          </p>
          <button
            type="button"
            onClick={() => setAttempt((count) => count + 1)}
            className="inline-flex items-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container-high"
          >
            <RefreshCw size={15} aria-hidden="true" />
            Try again
          </button>
        </div>
      ) : !isLoaded ? (
        <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-on-surface-variant">
          <Loader2 size={18} className="animate-spin text-primary" aria-hidden="true" />
          Loading the plan...
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-[13px] font-semibold text-on-surface">Today, {dayHeading(today)}</p>
            {items.length > 0 && (
              <div className="flex min-w-[220px] flex-1 items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container-high" aria-hidden="true">
                  <div className="h-full rounded-full bg-success transition-all" style={{ width: `${Math.round((doneCount / items.length) * 100)}%` }} />
                </div>
                <span className="text-[12px] font-semibold text-on-surface-variant">
                  {doneCount} of {items.length} done
                </span>
              </div>
            )}
          </div>

          {tickError && (
            <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
              {tickError}
            </p>
          )}

          <SortableList
            items={items}
            getId={getId}
            getLabel={getLabel}
            onReorder={reorder}
            label="Plan items"
            className="flex flex-col gap-1.5"
            renderItem={(item, handle) => (
              <div className="group flex items-center gap-2 rounded-xl border border-outline-variant/70 bg-surface-container-lowest py-1.5 pl-1 pr-2">
                {handle}
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={(event) => void tick(item, event.target.checked)}
                  aria-label={`Mark "${item.text}" as ${item.done ? "not done" : "done"} today`}
                  className="h-4 w-4 shrink-0 accent-primary"
                />
                <input
                  value={item.text}
                  maxLength={PLAN_ITEM_MAX_LENGTH}
                  onChange={(event) =>
                    edit((latest) => ({ items: latest.items.map((entry) => (entry.id === item.id ? { ...entry, text: event.target.value } : entry)), notes: latest.notes }))
                  }
                  aria-label="Plan item"
                  className={`min-w-0 flex-1 bg-transparent py-1 text-[14px] focus:outline-none ${item.done ? "text-outline line-through" : "text-on-surface"}`}
                />
                {item.completedAt && <span className="hidden shrink-0 text-[11px] text-outline sm:inline">Done {tickTime(item.completedAt)}</span>}
                <button
                  type="button"
                  onClick={() => edit((latest) => ({ items: latest.items.filter((entry) => entry.id !== item.id), notes: latest.notes }))}
                  aria-label={`Remove "${item.text}"`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-outline opacity-70 transition-colors hover:bg-error-container hover:text-error group-hover:opacity-100"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            )}
          />

          <form
            onSubmit={(event) => {
              event.preventDefault()
              addItem()
            }}
            className="flex gap-2"
          >
            <input
              value={newItem}
              maxLength={PLAN_ITEM_MAX_LENGTH}
              onChange={(event) => setNewItem(event.target.value)}
              disabled={items.length >= PLAN_MAX_ITEMS}
              placeholder={items.length >= PLAN_MAX_ITEMS ? EMPLOYEE_MESSAGES.tooManyItems : "Add a task to the daily plan and press Enter"}
              aria-label="New plan item"
              className="h-10 min-w-0 flex-1 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[14px] focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
            <button
              type="submit"
              disabled={!newItem.trim() || items.length >= PLAN_MAX_ITEMS}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-50"
            >
              <Plus size={15} aria-hidden="true" />
              Add
            </button>
          </form>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-outline">Notes (not shown on the employee&apos;s link)</span>
            <textarea
              value={draft.notes}
              maxLength={PLAN_NOTES_MAX_LENGTH}
              onChange={(event) => edit((latest) => ({ items: latest.items, notes: event.target.value }))}
              rows={3}
              placeholder="Anything to remember about this plan"
              className="w-full resize-y rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-[14px] leading-relaxed focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
          </label>
        </>
      )}

      <div className="border-t border-outline-variant/70 pt-4">
        <PlanHistory history={history} error={historyError} isLoadingMore={isLoadingHistory} onLoadMore={() => history?.nextBefore && void loadOlderHistory(history.nextBefore)} />
      </div>
    </section>
  )
}
