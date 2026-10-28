"use client"

import React, { useState } from "react"
import { Check, Loader2, RotateCcw } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { autoAdditional, formatMoney, monthLabel, summarizeMonth } from "@/lib/budget"
import type { BudgetMonth, BudgetSettings } from "@/types/budget"
import { AmountInput, Money } from "./BudgetParts"

interface ReviewDistributionDialogProps {
  month: BudgetMonth
  settings: BudgetSettings
  previousBalance: number
  isSaving: boolean
  error: string | null
  onConfirm: (fixed: Record<string, number>, additional: Record<string, number> | null) => void
  onClose: () => void
}

/**
 * The popup the month ends with, once every expense is in: what came in, what went out and the
 * profit, then each participant's fixed amount and additional amount, both editable, what that leaves
 * in the business and the balance the month ends on, all worked out again as anything is changed.
 * The additional amounts follow the rule until one is typed over; "Work it out again" goes back to it.
 */
export const ReviewDistributionDialog: React.FC<ReviewDistributionDialogProps> = ({ month, settings, previousBalance, isSaving, error, onConfirm, onClose }) => {
  const [fixed, setFixed] = useState<Record<string, number>>(month.fixed)
  const [additional, setAdditional] = useState<Record<string, number> | null>(month.additional)
  const summary = summarizeMonth({ ...month, fixed, additional }, month.month, settings, previousBalance)
  const currency = settings.baseCurrency

  // Everyone who takes part now, and anyone no longer listed who already has an amount this month
  const ids = [
    ...settings.participants.filter((participant) => participant.active || participant.id in fixed || (additional && participant.id in additional)).map((participant) => participant.id),
  ]
  const nameOf = (id: string) => settings.participants.find((participant) => participant.id === id)?.name ?? "Removed participant"
  const auto = autoAdditional(summary.remainder, settings.participants, settings.reinvestPercent)

  const line = (label: string, amount: number, strong = false) => (
    <div className={`flex items-baseline justify-between gap-3 ${strong ? "font-bold text-on-surface" : "text-on-surface-variant"}`}>
      <span>{label}</span>
      <Money amount={amount} currency={currency} tone="auto" />
    </div>
  )

  return (
    <Modal
      title={`Review the distribution for ${monthLabel(month.month)}`}
      description="Check what each person receives this month. Change any amount, then confirm."
      onClose={onClose}
      isCloseDisabled={isSaving}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-[20px] text-xs" aria-live="polite">
            {error && (
              <p role="alert" className="text-error">
                {error}
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onClose} disabled={isSaving} className="whitespace-nowrap rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-50">
              Not yet
            </button>
            <button
              type="button"
              onClick={() => onConfirm(fixed, additional)}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
              Confirm distribution
            </button>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section className="flex flex-col gap-1.5 rounded-2xl border border-outline-variant bg-surface-container-low p-4 text-sm">
          {line("Came in", summary.earning)}
          {line("Went out", -summary.expense)}
          {line(summary.profit < 0 ? "Loss" : "Profit", summary.profit, true)}
          {line("Fixed distribution", -summary.fixedTotal)}
          {line("Left after fixed", summary.remainder, true)}
          {line("Additional distribution", -summary.additionalTotal)}
          <hr className="my-1 border-outline-variant" />
          {line("Reinvested in the business", summary.reinvested, true)}
          {line("Balance before this month", summary.previousBalance)}
          {line("Balance after this month", summary.newBalance, true)}
          {summary.remainder > 0 && (
            <p className="mt-2 text-[11px] text-on-surface-variant">
              Of what is left after the fixed amounts, {settings.reinvestPercent}% stays in the business and {100 - settings.reinvestPercent}% is shared as additional distribution.
            </p>
          )}
          {summary.remainder <= 0 && <p className="mt-2 text-[11px] text-on-surface-variant">Nothing is left after the fixed amounts, so there is no additional distribution and the fixed amounts come out of the balance.</p>}
        </section>

        <section className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-on-surface">What each person receives</h3>
            {additional !== null && (
              <button type="button" onClick={() => setAdditional(null)} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 text-[12px] font-semibold text-primary hover:bg-primary/5">
                <RotateCcw size={13} aria-hidden="true" /> Work it out again
              </button>
            )}
          </div>
          {ids.length === 0 && <p className="text-[12px] text-on-surface-variant">Add the people the profit is shared with in Settings.</p>}
          {ids.map((id) => (
            <div key={id} className="grid grid-cols-2 items-end gap-2 rounded-xl border border-outline-variant p-3 sm:grid-cols-[minmax(0,1fr)_8.5rem_8.5rem_minmax(0,1fr)]">
              <p className="col-span-2 break-words text-sm font-bold text-on-surface sm:col-span-1 sm:self-center">{nameOf(id)}</p>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-outline">Fixed</span>
                <AmountInput value={fixed[id] ?? 0} onChange={(value) => setFixed((current) => ({ ...current, [id]: value }))} ariaLabel={`Fixed amount for ${nameOf(id)}`} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-outline">Additional</span>
                <AmountInput
                  value={(additional ?? auto)[id] ?? 0}
                  onChange={(value) => setAdditional((current) => ({ ...(current ?? auto), [id]: value }))}
                  ariaLabel={`Additional amount for ${nameOf(id)}`}
                />
              </label>
              <p className="col-span-2 text-right text-[12px] text-on-surface-variant sm:col-span-1 sm:self-center">
                Send <span className="font-bold text-on-surface">{formatMoney(summary.transfers[id] ?? 0, currency)}</span>
              </p>
            </div>
          ))}
          <p className="text-[11px] text-on-surface-variant">
            {additional === null ? "The additional amounts follow the rule. Type over one to set it yourself." : "You have set the additional amounts yourself for this month."}
          </p>
        </section>
      </div>
    </Modal>
  )
}
