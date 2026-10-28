"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, FileDown, Loader2, LockOpen, Printer, Trash2 } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { Modal } from "@/components/ui/Modal"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { useBudgetLedger } from "@/hooks/useBudgetLedger"
import { requestApi } from "@/lib/apiClient"
import { canKeepalive } from "@/constants/textLimits"
import {
  buildLedger,
  defaultFixed,
  emptyExpense,
  emptyPayment,
  entriesCsv,
  formatMoney,
  monthLabel,
  monthOfDate,
  newId,
  shiftMonth,
  suggestionsOf,
} from "@/lib/budget"
import { BUDGET_AUTOSAVE_DELAY_MS, BUDGET_HREF, BUDGET_MESSAGES, BUDGET_TOOL, budgetMonthEndpoint, budgetMonthHref } from "@/constants/budget"
import type { BudgetExpense, BudgetMonth, BudgetPayment, BudgetPaymentPart } from "@/types/budget"
import { BudgetSuggestions, Money, StatCard, downloadText } from "@/components/budget/BudgetParts"
import { ExpenseList, PaymentList } from "@/components/budget/EntryLists"
import { SplitPaymentDialog } from "@/components/budget/SplitPaymentDialog"
import { ReviewDistributionDialog } from "@/components/budget/ReviewDistributionDialog"

type SaveState = "idle" | "waiting" | "saving" | "saved" | "failed"

const buttonClass =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-outline-variant bg-surface-container-lowest px-3.5 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"

const bodyOf = (month: BudgetMonth, confirmed?: boolean) =>
  JSON.stringify({ payments: month.payments, expenses: month.expenses, fixed: month.fixed, additional: month.additional, ...(confirmed === undefined ? {} : { confirmed }) })

/**
 * One month of the budget: the payments and the expenses typed straight into their lists, and
 * everything else worked out as they are typed (what came in, what went out, the profit, each
 * person's distribution, what is reinvested, and the balance before and after). It saves itself a
 * moment after typing settles. Once every expense is in, "Review distribution" opens the popup that
 * confirms (or changes) what each person is sent.
 */
export default function BudgetMonthClient({ monthId }: { monthId: string }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const { ledger, setLedger, error, reload } = useBudgetLedger()
  const [draft, setDraft] = useState<BudgetMonth | null>(null)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [splitting, setSplitting] = useState<BudgetPayment | null>(null)
  const [isReviewing, setIsReviewing] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [isClearing, setIsClearing] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const pending = useRef<BudgetMonth | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const queue = useRef<Promise<unknown>>(Promise.resolve())

  // The month as stored, or a fresh one whose fixed amounts start from each person's own, once the ledger is in
  const stored = ledger?.months.find((month) => month.month === monthId) ?? null
  const isRecorded = Boolean(stored) || saveState === "saved"
  const month = useMemo<BudgetMonth | null>(
    () =>
      draft ??
      (ledger ? stored ?? { month: monthId, payments: [], expenses: [], fixed: defaultFixed(ledger.settings.participants), additional: null, confirmedAt: null, updatedAt: null } : null),
    [draft, ledger, stored, monthId]
  )
  const settings = ledger?.settings
  const currency = settings?.baseCurrency ?? "PKR"

  const summary = useMemo(() => {
    if (!ledger || !month) return null
    const months = [...ledger.months.filter((entry) => entry.month !== monthId), month]
    return buildLedger(months, ledger.settings, monthOfDate(new Date())).find((entry) => entry.month === monthId) ?? null
  }, [ledger, month, monthId])
  const suggestions = useMemo(() => suggestionsOf(ledger ? [...ledger.months, ...(month ? [month] : [])] : []), [ledger, month])

  const send = useCallback(
    (next: BudgetMonth, confirmed?: boolean, keepalive = false) => {
      const body = bodyOf(next, confirmed)
      const run = queue.current.then(async () => {
        setSaveState("saving")
        try {
          const { data } = await requestApi<BudgetMonth>(
            budgetMonthEndpoint(monthId),
            { method: "PUT", headers: { "Content-Type": "application/json" }, body, keepalive: keepalive && canKeepalive(body) },
            { retry: true }
          )
          setLedger((current) => (current ? { ...current, months: [...current.months.filter((entry) => entry.month !== monthId), data].sort((a, b) => a.month.localeCompare(b.month)) } : current))
          setDraft((current) => (current ? { ...current, confirmedAt: data.confirmedAt, updatedAt: data.updatedAt } : current))
          setSaveState(pending.current ? "waiting" : "saved")
          setSaveError(null)
          return data
        } catch (reason: unknown) {
          setSaveState("failed")
          setSaveError(reason instanceof Error ? reason.message : BUDGET_MESSAGES.saveFailed)
          throw reason
        }
      })
      queue.current = run.catch(() => undefined)
      return run
    },
    [monthId, setLedger]
  )

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const next = pending.current
    pending.current = null
    return next ? send(next).catch(() => undefined) : Promise.resolve()
  }, [send])

  // Every change goes through here: shown at once, saved a moment after typing settles
  const change = (update: (current: BudgetMonth) => BudgetMonth) => {
    if (!month) return
    const next = update(month)
    setDraft(next)
    pending.current = next
    setSaveState("waiting")
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), BUDGET_AUTOSAVE_DELAY_MS)
  }

  // A change still waiting is sent as the page goes, so closing the tab never loses the last edit
  useEffect(() => {
    const onHide = () => {
      if (!pending.current) return
      const next = pending.current
      pending.current = null
      void send(next, undefined, true).catch(() => undefined)
    }
    window.addEventListener("pagehide", onHide)
    return () => {
      window.removeEventListener("pagehide", onHide)
      onHide()
    }
  }, [send])

  const changePayment = (id: string, patch: Partial<BudgetPayment>) => change((current) => ({ ...current, payments: current.payments.map((payment) => (payment.id === id ? { ...payment, ...patch } : payment)) }))
  const changeExpense = (id: string, patch: Partial<BudgetExpense>) => change((current) => ({ ...current, expenses: current.expenses.map((expense) => (expense.id === id ? { ...expense, ...patch } : expense)) }))
  const firstOfMonth = `${monthId}-01`
  const today = new Date().toISOString().slice(0, 10)
  const newPaymentDate = today.startsWith(monthId) ? today : firstOfMonth

  const confirm = async (fixed: Record<string, number>, additional: Record<string, number> | null) => {
    if (!month) return
    setIsConfirming(true)
    setReviewError(null)
    if (timer.current) clearTimeout(timer.current)
    pending.current = null
    const next = { ...month, fixed, additional }
    setDraft(next)
    try {
      await send(next, true)
      setIsReviewing(false)
    } catch (reason: unknown) {
      setReviewError(reason instanceof Error ? reason.message : BUDGET_MESSAGES.saveFailed)
    } finally {
      setIsConfirming(false)
    }
  }

  const reopen = async () => {
    if (!month) return
    await flush()
    await send(month, false).catch(() => undefined)
  }

  const clearMonth = async () => {
    setIsClearing(true)
    if (timer.current) clearTimeout(timer.current)
    pending.current = null
    try {
      await queue.current
      await requestApi(budgetMonthEndpoint(monthId), { method: "DELETE" })
      setDraft(null)
      setSaveState("idle")
      setConfirmClear(false)
      reload()
    } catch (reason: unknown) {
      setSaveError(reason instanceof Error ? reason.message : BUDGET_MESSAGES.saveFailed)
    } finally {
      setIsClearing(false)
    }
  }

  const nameOf = (id: string) => settings?.participants.find((participant) => participant.id === id)?.name ?? "Removed participant"
  const saveLabel = { idle: "", waiting: "Changes not saved yet", saving: "Saving...", saved: "All changes saved", failed: saveError ?? BUDGET_MESSAGES.saveFailed }[saveState]
  const Icon = BUDGET_TOOL.icon

  return (
    <div data-print-page className="font-body-md text-body-md flex h-screen min-h-screen overflow-hidden bg-background text-on-surface">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setIsSidebarOpen(true)} isSidebarCollapsed={isCollapsed} onToggleCollapse={toggleCollapsed} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 md:p-6 lg:min-h-full lg:p-8">
            <div data-print-hide className="flex flex-wrap items-center justify-between gap-2">
              <Link href={BUDGET_HREF} onClick={() => void flush()} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                <ArrowLeft size={15} aria-hidden="true" /> All months
              </Link>
              <div className="flex items-center gap-1">
                <Link href={budgetMonthHref(shiftMonth(monthId, -1))} onClick={() => void flush()} className={buttonClass} aria-label="Previous month">
                  <ChevronLeft size={16} aria-hidden="true" /> {monthLabel(shiftMonth(monthId, -1), "short")}
                </Link>
                <Link href={budgetMonthHref(shiftMonth(monthId, 1))} onClick={() => void flush()} className={buttonClass} aria-label="Next month">
                  {monthLabel(shiftMonth(monthId, 1), "short")} <ChevronRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-on-surface">
                  <Icon size={24} className="shrink-0 text-primary" aria-hidden="true" />
                  {monthLabel(monthId)}
                  {month?.confirmedAt ? (
                    <span className="rounded-full bg-success-container px-2.5 py-0.5 text-[11px] font-bold text-on-success-container">Distribution confirmed</span>
                  ) : isRecorded ? (
                    <span className="rounded-full bg-secondary-fixed px-2.5 py-0.5 text-[11px] font-bold text-on-secondary-fixed-variant">Open</span>
                  ) : null}
                </h1>
                <p className="mt-1 min-h-5 text-sm text-on-surface-variant" aria-live="polite">
                  <span className={saveState === "failed" ? "text-error" : ""}>{saveLabel || (isRecorded ? "" : BUDGET_MESSAGES.emptyMonth)}</span>
                </p>
              </div>
              <div data-print-hide className="flex flex-wrap gap-2">
                <button type="button" onClick={() => window.print()} disabled={!month} className={buttonClass}>
                  <Printer size={16} aria-hidden="true" /> PDF
                </button>
                <button type="button" onClick={() => month && downloadText(`budget-${monthId}.csv`, entriesCsv([month], currency))} disabled={!month} className={buttonClass}>
                  <FileDown size={16} aria-hidden="true" /> CSV
                </button>
                {isRecorded && (
                  <button type="button" onClick={() => setConfirmClear(true)} className={`${buttonClass} hover:text-error`}>
                    <Trash2 size={16} aria-hidden="true" /> Clear month
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-error/30 bg-error-container px-4 py-3 text-sm text-on-error-container" role="alert">
                {error}
                <button type="button" onClick={reload} className="font-semibold underline">
                  Try again
                </button>
              </div>
            )}
            {!month && !error && (
              <p className="flex items-center gap-2 text-sm text-on-surface-variant">
                <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Loading the month...
              </p>
            )}

            {month && summary && settings && (
              <>
                <BudgetSuggestions suggestions={suggestions} />
                <section className="grid grid-cols-2 gap-3 xl:grid-cols-4 2xl:grid-cols-7">
                  <StatCard label="Came in" amount={summary.earning} currency={currency} />
                  <StatCard label="Went out" amount={summary.expense} currency={currency} />
                  <StatCard label={summary.profit < 0 ? "Loss" : "Profit"} amount={summary.profit} currency={currency} tone={summary.profit < 0 ? "error" : "plain"} />
                  <StatCard label="Distributed" amount={summary.distributed} currency={currency} hint={`Fixed ${Math.round(summary.fixedTotal).toLocaleString("en-US")} · additional ${Math.round(summary.additionalTotal).toLocaleString("en-US")}`} />
                  <StatCard label="Reinvested" amount={summary.reinvested} currency={currency} tone={summary.reinvested < 0 ? "error" : "success"} />
                  <StatCard label="Balance before" amount={summary.previousBalance} currency={currency} />
                  <StatCard label="Balance after" amount={summary.newBalance} currency={currency} tone="primary" />
                </section>
                {summary.uncounted > 0 && <p className="text-[12px] text-error">Some amounts are in another currency with no rate, so they are not counted yet.</p>}

                <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-bold text-on-surface">What each person is sent</h2>
                    <div data-print-hide className="flex flex-wrap gap-2">
                      {month.confirmedAt && (
                        <button type="button" onClick={() => void reopen()} className={buttonClass}>
                          <LockOpen size={15} aria-hidden="true" /> Open the month again
                        </button>
                      )}
                      <button type="button" onClick={() => setIsReviewing(true)} className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary-hover">
                        <ClipboardCheck size={16} aria-hidden="true" /> {month.confirmedAt ? "Change distribution" : "Review distribution"}
                      </button>
                    </div>
                  </div>
                  <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                    {Object.keys(summary.transfers).length === 0 && <li className="text-[12px] text-on-surface-variant">Add the people the profit is shared with in Settings on the report page.</li>}
                    {Object.entries(summary.transfers).map(([id, amount]) => (
                      <li key={id} className="rounded-xl border border-outline-variant p-3">
                        <p className="break-words text-sm font-bold text-on-surface">{nameOf(id)}</p>
                        <p className="mt-0.5 text-lg font-bold tabular-nums text-primary">{formatMoney(amount, currency)}</p>
                        <p className="text-[11px] text-on-surface-variant">
                          Fixed <Money amount={summary.fixed[id] ?? 0} currency={currency} /> · additional <Money amount={summary.additional[id] ?? 0} currency={currency} />
                        </p>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-on-surface-variant">
                    {summary.isAdditionalManual ? "The additional amounts were set by hand for this month." : `Additional: ${100 - settings.reinvestPercent}% of what is left after the fixed amounts, shared by each person's share.`}
                  </p>
                </section>

                <section className="flex flex-col gap-2">
                  <h2 className="text-base font-bold text-on-surface">
                    What came in <span className="font-normal text-on-surface-variant">· {month.payments.length} {month.payments.length === 1 ? "payment" : "payments"}</span>
                  </h2>
                  <PaymentList
                    payments={month.payments}
                    baseCurrency={currency}
                    onChange={changePayment}
                    onAdd={() => change((current) => ({ ...current, payments: [...current.payments, emptyPayment(newId(), currency, newPaymentDate)] }))}
                    onRemove={(id) => change((current) => ({ ...current, payments: current.payments.filter((payment) => payment.id !== id) }))}
                    onSplit={setSplitting}
                  />
                </section>

                <section className="flex flex-col gap-2">
                  <h2 className="text-base font-bold text-on-surface">
                    What went out <span className="font-normal text-on-surface-variant">· {month.expenses.length} {month.expenses.length === 1 ? "expense" : "expenses"}</span>
                  </h2>
                  <ExpenseList
                    expenses={month.expenses}
                    baseCurrency={currency}
                    onChange={changeExpense}
                    onAdd={() => change((current) => ({ ...current, expenses: [...current.expenses, emptyExpense(newId(), currency)] }))}
                    onRemove={(id) => change((current) => ({ ...current, expenses: current.expenses.filter((expense) => expense.id !== id) }))}
                  />
                  {!month.confirmedAt && (
                    <button
                      type="button"
                      data-print-hide
                      onClick={() => {
                        void flush()
                        setIsReviewing(true)
                      }}
                      className="inline-flex items-center justify-center gap-2 self-start whitespace-nowrap rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
                    >
                      <CheckCircle2 size={16} aria-hidden="true" /> All expenses are in: review distribution
                    </button>
                  )}
                </section>
              </>
            )}
          </div>
        </main>
      </div>

      {splitting && (
        <SplitPaymentDialog
          key={splitting.id}
          payment={splitting}
          onSave={(parts: BudgetPaymentPart[]) => {
            changePayment(splitting.id, { parts })
            setSplitting(null)
          }}
          onClose={() => setSplitting(null)}
        />
      )}
      {isReviewing && month && settings && summary && (
        <ReviewDistributionDialog
          month={month}
          settings={settings}
          previousBalance={summary.previousBalance}
          isSaving={isConfirming}
          error={reviewError}
          onConfirm={(fixed, additional) => void confirm(fixed, additional)}
          onClose={() => setIsReviewing(false)}
        />
      )}
      {confirmClear && (
        <Modal
          title={`Clear ${monthLabel(monthId)}?`}
          description="Every payment, expense and distribution of this month is removed, and the balances of the months after it change to match. This can't be undone."
          onClose={() => setConfirmClear(false)}
          isCloseDisabled={isClearing}
          size="compact"
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmClear(false)} disabled={isClearing} className={buttonClass}>
                Cancel
              </button>
              <button type="button" onClick={() => void clearMonth()} disabled={isClearing} className="inline-flex items-center gap-2 rounded-xl bg-error px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {isClearing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Trash2 size={16} aria-hidden="true" />} Clear month
              </button>
            </div>
          }
        >
          <p className="text-sm text-on-surface-variant">
            {month ? `${month.payments.length} payments and ${month.expenses.length} expenses will be removed.` : ""}
          </p>
        </Modal>
      )}
    </div>
  )
}
