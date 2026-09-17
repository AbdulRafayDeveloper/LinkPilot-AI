"use client"

import React, { useEffect, useState } from "react"
import Image from "next/image"
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, RotateCcw } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { SortableList } from "@/components/ui/SortableList"
import { PlanHistory, dayHeading, mergeHistory, tickTime } from "@/components/employees/PlanHistory"
import { requestApi } from "@/lib/apiClient"
import { todayIso } from "@/lib/taskDates"
import { SITE_LOGO_PNG, SITE_SHORT_NAME } from "@/config/site"
import { EMPLOYEE_MESSAGES, PUBLIC_PLAN_ENDPOINT } from "@/constants/employees"
import type { PlanHistoryPage, PlanItem, PublicPlan } from "@/types/employees"

/**
 * The page an employee opens from their link, without an account. Today's tasks to tick off (and
 * untick) and drag into the order they want (their own view only), a Reset that clears today's ticks and brings back the plan's order, and the history of
 * earlier days. Nothing here adds, rewords or deletes a task, and earlier days can't be changed.
 */
export default function PublicPlanClient({ token }: { token: string }) {
  const [plan, setPlan] = useState<PublicPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [isMoving, setIsMoving] = useState(false)
  const [isResetOpen, setIsResetOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const endpoint = `${PUBLIC_PLAN_ENDPOINT}/${encodeURIComponent(token)}`

  useEffect(() => {
    const controller = new AbortController()
    const load = () =>
      requestApi<PublicPlan>(`${endpoint}?today=${todayIso()}`, { signal: controller.signal })
        .then(({ data }) => {
          setPlan(data)
          setError(null)
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : EMPLOYEE_MESSAGES.linkInvalid)
        })
    void load()
    // Coming back to the tab (or past midnight) picks up tasks the manager added meanwhile
    const refresh = () => {
      if (document.visibilityState === "visible") void load()
    }
    document.addEventListener("visibilitychange", refresh)
    return () => {
      controller.abort()
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [endpoint, attempt])

  const setToday = (today: PublicPlan["today"]) => setPlan((current) => current && { ...current, today })

  const tick = async (item: PlanItem, done: boolean) => {
    if (!plan) return
    const previous = plan.today
    setToday({ ...previous, items: previous.items.map((entry) => (entry.id === item.id ? { ...entry, done, completedAt: done ? new Date().toISOString() : null } : entry)) })
    setSavingId(item.id)
    setActionError(null)
    try {
      const { data } = await requestApi<PublicPlan["today"]>(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ today: previous.date, itemId: item.id, done }),
      })
      setToday(data)
    } catch (reason: unknown) {
      setToday(previous)
      setActionError(reason instanceof Error ? reason.message : EMPLOYEE_MESSAGES.tickFailed)
    } finally {
      setSavingId(null)
    }
  }

  /**
   * Moves tasks up and down: the new order shows at once and is kept for this link (through a refresh
   * and on later days) until Reset today. The manager's plan keeps its own order.
   * If the plan changed meanwhile (the manager edited it), the page reloads it rather than guessing.
   */
  const reorder = async (ids: string[]) => {
    if (!plan) return
    const previous = plan.today
    const byId = new Map(previous.items.map((entry) => [entry.id, entry]))
    setToday({ ...previous, ownOrder: true, items: ids.map((id) => byId.get(id)).filter((entry): entry is PlanItem => Boolean(entry)) })
    setIsMoving(true)
    setActionError(null)
    try {
      const { data } = await requestApi<PublicPlan["today"]>(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ today: previous.date, order: ids }),
      })
      setToday(data)
    } catch (reason: unknown) {
      setToday(previous)
      setActionError(reason instanceof Error ? reason.message : EMPLOYEE_MESSAGES.orderFailed)
      if (reason instanceof Error && reason.message === EMPLOYEE_MESSAGES.orderChanged) setAttempt((count) => count + 1)
    } finally {
      setIsMoving(false)
    }
  }

  const reset = async () => {
    if (!plan) return
    setIsResetting(true)
    setActionError(null)
    try {
      const { data } = await requestApi<PublicPlan["today"]>(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ today: plan.today.date }),
      }, { retry: true })
      setToday(data)
      setIsResetOpen(false)
    } catch (reason: unknown) {
      setActionError(reason instanceof Error ? reason.message : EMPLOYEE_MESSAGES.resetFailed)
      setIsResetOpen(false)
    } finally {
      setIsResetting(false)
    }
  }

  const loadOlder = async () => {
    const before = plan?.history.nextBefore
    if (!before) return
    setIsLoadingHistory(true)
    try {
      const { data } = await requestApi<PlanHistoryPage>(`${endpoint}?before=${before}`)
      setPlan((current) => current && { ...current, history: mergeHistory(current.history, data) })
      setHistoryError(null)
    } catch (reason: unknown) {
      setHistoryError(reason instanceof Error ? reason.message : EMPLOYEE_MESSAGES.historyFailed)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const items = plan?.today.items ?? []
  const doneCount = items.filter((item) => item.done).length

  return (
    <div className="min-h-dvh bg-background text-on-surface">
      <header className="border-b border-outline-variant/80 bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-2.5 px-4 py-3">
          <Image src={SITE_LOGO_PNG} alt="" width={32} height={32} className="h-8 w-8" priority />
          <span className="text-[15px] font-bold tracking-tight">{SITE_SHORT_NAME}</span>
          <span className="ml-auto text-[12px] text-outline">Daily plan</span>
        </div>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-6 sm:py-8">
        {error && !plan ? (
          <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-outline-variant bg-white px-6 py-12 text-center">
            <AlertCircle size={24} className="text-error" aria-hidden="true" />
            <p className="max-w-sm text-sm text-on-surface-variant">{error}</p>
            <button
              type="button"
              onClick={() => setAttempt((count) => count + 1)}
              className="inline-flex items-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold hover:bg-surface-container-high"
            >
              <RefreshCw size={15} aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : !plan ? (
          <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-on-surface-variant">
            <Loader2 size={20} className="animate-spin text-primary" aria-hidden="true" />
            Loading your plan...
          </div>
        ) : (
          <>
            <div>
              <p className="text-[13px] font-semibold text-primary">{plan.employee.role}</p>
              <h1 className="text-2xl font-bold tracking-tight">Hi {plan.employee.name.split(" ")[0]}, here&apos;s your plan</h1>
              <p className="mt-1 text-sm text-on-surface-variant">{dayHeading(plan.today.date)}</p>
            </div>

            <section aria-label="Today's tasks" className="flex flex-col gap-4 rounded-2xl border border-outline-variant bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-bold">Today</h2>
                {(doneCount > 0 || plan.today.ownOrder) && (
                  <button
                    type="button"
                    onClick={() => setIsResetOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                  >
                    <RotateCcw size={13} aria-hidden="true" />
                    Reset today
                  </button>
                )}
              </div>

              {items.length === 0 ? (
                <p className="py-6 text-center text-sm text-on-surface-variant">No tasks for today yet. Check back once your plan is ready.</p>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-container-high" aria-hidden="true">
                      <div className="h-full rounded-full bg-success transition-all" style={{ width: `${Math.round((doneCount / items.length) * 100)}%` }} />
                    </div>
                    <span className="text-[13px] font-semibold text-on-surface-variant" aria-live="polite">
                      {doneCount} of {items.length} done
                    </span>
                  </div>
                  {doneCount === items.length && (
                    <p className="flex items-center gap-2 rounded-xl bg-success-container px-3 py-2 text-[13px] font-semibold text-on-success-container">
                      <CheckCircle2 size={16} aria-hidden="true" />
                      Everything done for today.
                    </p>
                  )}
                  <SortableList
                    items={items}
                    getId={(item) => item.id}
                    getLabel={(item) => item.text}
                    onReorder={(ids) => void reorder(ids)}
                    disabled={isMoving}
                    label="Today's tasks"
                    className="flex flex-col gap-2"
                    renderItem={(item, handle) => (
                      <div
                        className={`flex items-center gap-1.5 rounded-xl border py-1.5 pl-1 pr-3 transition-colors ${
                          item.done ? "border-success/40 bg-success-container/40" : "border-outline-variant bg-surface-container-lowest hover:bg-white"
                        }`}
                      >
                        {handle}
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-1.5">
                          <input
                            type="checkbox"
                            checked={item.done}
                            disabled={savingId === item.id}
                            onChange={(event) => void tick(item, event.target.checked)}
                            className="h-5 w-5 shrink-0 accent-primary"
                          />
                          <span className={`min-w-0 flex-1 break-words text-[15px] ${item.done ? "text-on-surface-variant line-through" : "text-on-surface"}`}>{item.text}</span>
                          {savingId === item.id ? (
                            <Loader2 size={14} className="shrink-0 animate-spin text-primary" aria-hidden="true" />
                          ) : (
                            item.completedAt && <span className="shrink-0 text-[12px] text-outline">{tickTime(item.completedAt)}</span>
                          )}
                        </label>
                      </div>
                    )}
                  />
                </>
              )}

              {actionError && (
                <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[13px] text-error">
                  {actionError}
                </p>
              )}
            </section>

            <PlanHistory history={plan.history} error={historyError} isLoadingMore={isLoadingHistory} onLoadMore={() => void loadOlder()} />
          </>
        )}
      </main>

      {isResetOpen && (
        <Modal
          title="Reset today?"
          description="Every task for today goes back to not done, and the tasks go back to the order your manager set. Earlier days in your history stay as they are."
          onClose={() => setIsResetOpen(false)}
          isCloseDisabled={isResetting}
          size="compact"
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsResetOpen(false)} disabled={isResetting} className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold hover:bg-surface-container-high">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void reset()}
                disabled={isResetting}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-on-primary-fixed-variant disabled:opacity-60"
              >
                {isResetting && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                Reset today
              </button>
            </div>
          }
        >
          <p className="text-sm text-on-surface-variant">
            {doneCount} of {items.length} tasks are ticked now.
          </p>
        </Modal>
      )}
    </div>
  )
}
