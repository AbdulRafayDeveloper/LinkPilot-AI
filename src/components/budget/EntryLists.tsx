"use client"

import React from "react"
import { Plus, Split, Trash2 } from "lucide-react"
import { BUDGET_EXPENSE_CATEGORIES, BUDGET_MESSAGES } from "@/constants/budget"
import { inBase } from "@/lib/budget"
import type { BudgetExpense, BudgetPayment } from "@/types/budget"
import { AmountInput, CurrencyInput, Money, RowField, fieldClass } from "./BudgetParts"

/**
 * The month's payments and expenses, edited where they are listed: every field of every row is an
 * input, so a typing mistake is fixed in place and nothing opens to change it. Each row is a small
 * card whose fields sit in a grid that widens with the screen, so the same row reads on a phone and
 * on a laptop without anything scrolling sideways.
 */

const iconButton =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-40"

const RateField: React.FC<{ currency: string; base: string; rate: number | null; onChange: (rate: number | null) => void; disabled?: boolean }> = ({
  currency,
  base,
  rate,
  onChange,
  disabled,
}) =>
  currency === base ? null : (
    <RowField label={`1 ${currency || "?"} = ${base}`}>
      <AmountInput value={rate ?? 0} onChange={(value) => onChange(value > 0 ? value : null)} disabled={disabled} ariaLabel={`Rate from ${currency} to ${base}`} />
    </RowField>
  )

interface PaymentListProps {
  payments: BudgetPayment[]
  baseCurrency: string
  disabled?: boolean
  onChange: (id: string, change: Partial<BudgetPayment>) => void
  onAdd: () => void
  onRemove: (id: string) => void
  onSplit: (payment: BudgetPayment) => void
}

export const PaymentList: React.FC<PaymentListProps> = ({ payments, baseCurrency, disabled, onChange, onAdd, onRemove, onSplit }) => (
  <div className="flex flex-col gap-2">
    {payments.map((payment, index) => {
      const counted = inBase(payment, baseCurrency)
      return (
        <div key={payment.id} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[12px] font-bold text-on-surface-variant">Payment {index + 1}</span>
            <span className="flex items-center gap-1">
              {payment.parts.length > 0 && <span className="rounded-full bg-primary-fixed px-2 py-0.5 text-[10.5px] font-bold text-on-primary-fixed-variant">Split in {payment.parts.length}</span>}
              <button type="button" onClick={() => onSplit(payment)} disabled={disabled} className={iconButton} title="Split between clients or projects" aria-label={`Split payment ${index + 1}`}>
                <Split size={16} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => onRemove(payment.id)} disabled={disabled} className={`${iconButton} hover:text-error`} title="Delete this payment" aria-label={`Delete payment ${index + 1}`}>
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 2xl:grid-cols-8">
            <RowField label="Client">
              <input value={payment.clientName} list="budget-clients" onChange={(event) => onChange(payment.id, { clientName: event.target.value })} disabled={disabled || payment.parts.length > 0} placeholder={payment.parts.length > 0 ? "In the split" : "Lou"} className={fieldClass} />
            </RowField>
            <RowField label="Project">
              <input value={payment.projectName} list="budget-projects" onChange={(event) => onChange(payment.id, { projectName: event.target.value })} disabled={disabled || payment.parts.length > 0} placeholder={payment.parts.length > 0 ? "In the split" : "DropPR.ai"} className={fieldClass} />
            </RowField>
            <RowField label="Amount">
              <AmountInput value={payment.amount} onChange={(amount) => onChange(payment.id, { amount })} disabled={disabled} />
            </RowField>
            <div className="grid grid-cols-2 gap-2">
              <RowField label="Currency">
                <CurrencyInput value={payment.currency} onChange={(currency) => onChange(payment.id, { currency })} disabled={disabled} />
              </RowField>
              <RowField label="Date">
                <input type="date" value={payment.date} onChange={(event) => onChange(payment.id, { date: event.target.value })} disabled={disabled} className={`${fieldClass} px-1.5`} />
              </RowField>
            </div>
            <RateField currency={payment.currency} base={baseCurrency} rate={payment.rate} onChange={(rate) => onChange(payment.id, { rate })} disabled={disabled} />
            <RowField label="How the client was found">
              <input value={payment.clientSource} list="budget-sources" onChange={(event) => onChange(payment.id, { clientSource: event.target.value })} disabled={disabled} placeholder="Upwork, LinkedIn..." className={fieldClass} />
            </RowField>
            <RowField label="Received through">
              <input value={payment.receivedThrough} list="budget-through" onChange={(event) => onChange(payment.id, { receivedThrough: event.target.value })} disabled={disabled} placeholder="Own account" className={fieldClass} />
            </RowField>
            <RowField label="Method">
              <input value={payment.method} list="budget-methods" onChange={(event) => onChange(payment.id, { method: event.target.value })} disabled={disabled} placeholder="Remitly, Wise, bank..." className={fieldClass} />
            </RowField>
            <RowField label="What it was for" className="col-span-2 md:col-span-4 2xl:col-span-2">
              <input value={payment.description} list="budget-descriptions" onChange={(event) => onChange(payment.id, { description: event.target.value })} disabled={disabled} placeholder="Milestone 1, salary..." className={fieldClass} />
            </RowField>
          </div>
          {payment.currency !== baseCurrency && (
            <p className={`mt-2 text-[11px] ${counted === null ? "text-error" : "text-on-surface-variant"}`}>
              {counted === null ? BUDGET_MESSAGES.needsRate(payment.currency, baseCurrency) : <>Counted as <Money amount={counted} currency={baseCurrency} /></>}
            </p>
          )}
        </div>
      )
    })}
    <button
      type="button"
      onClick={onAdd}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-dashed border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
    >
      <Plus size={16} aria-hidden="true" /> Add a payment
    </button>
  </div>
)

interface ExpenseListProps {
  expenses: BudgetExpense[]
  baseCurrency: string
  disabled?: boolean
  onChange: (id: string, change: Partial<BudgetExpense>) => void
  onAdd: () => void
  onRemove: (id: string) => void
}

export const ExpenseList: React.FC<ExpenseListProps> = ({ expenses, baseCurrency, disabled, onChange, onAdd, onRemove }) => (
  <div className="flex flex-col gap-2">
    {expenses.map((expense, index) => {
      const counted = inBase(expense, baseCurrency)
      return (
        <div key={expense.id} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
          <div className="grid grid-cols-2 items-end gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)_5rem_minmax(0,1.6fr)_auto]">
            <RowField label="Expense" className="col-span-2 md:col-span-1">
              <input value={expense.name} list="budget-expenses" onChange={(event) => onChange(expense.id, { name: event.target.value })} disabled={disabled} placeholder="What the money went on" className={fieldClass} />
            </RowField>
            <RowField label="Category">
              <select value={expense.category} onChange={(event) => onChange(expense.id, { category: event.target.value })} disabled={disabled} className={fieldClass}>
                {BUDGET_EXPENSE_CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </RowField>
            <RowField label="Amount">
              <AmountInput value={expense.amount} onChange={(amount) => onChange(expense.id, { amount })} disabled={disabled} ariaLabel={`Amount of expense ${index + 1}`} />
            </RowField>
            <RowField label="Currency">
              <CurrencyInput value={expense.currency} onChange={(currency) => onChange(expense.id, { currency })} disabled={disabled} />
            </RowField>
            <RowField label="Note" className="md:col-span-1">
              <input value={expense.note} onChange={(event) => onChange(expense.id, { note: event.target.value })} disabled={disabled} placeholder="Optional" className={fieldClass} />
            </RowField>
            <button type="button" onClick={() => onRemove(expense.id)} disabled={disabled} className={`${iconButton} justify-self-end hover:text-error`} title="Delete this expense" aria-label={`Delete expense ${index + 1}`}>
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
          {expense.currency !== baseCurrency && (
            <div className="mt-2 grid grid-cols-2 items-end gap-2 md:grid-cols-4">
              <RateField currency={expense.currency} base={baseCurrency} rate={expense.rate} onChange={(rate) => onChange(expense.id, { rate })} disabled={disabled} />
              <p className={`col-span-2 text-[11px] md:col-span-3 ${counted === null ? "text-error" : "text-on-surface-variant"}`}>
                {counted === null ? BUDGET_MESSAGES.needsRate(expense.currency, baseCurrency) : <>Counted as <Money amount={counted} currency={baseCurrency} /></>}
              </p>
            </div>
          )}
        </div>
      )
    })}
    <button
      type="button"
      onClick={onAdd}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-dashed border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
    >
      <Plus size={16} aria-hidden="true" /> Add an expense
    </button>
  </div>
)
