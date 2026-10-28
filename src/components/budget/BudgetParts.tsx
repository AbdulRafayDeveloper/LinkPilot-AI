"use client"

import React from "react"
import { COMMON_CURRENCIES } from "@/constants/budget"
import { formatMoney, type BreakdownRow } from "@/lib/budget"

/**
 * The small pieces Budget Management's two pages are drawn from: a money figure, a headline card,
 * a ranked breakdown, the labelled inputs a list is edited in, and the suggestion lists those inputs
 * offer so a client or a method is spelled the same way every month.
 */

export const fieldClass =
  "w-full min-w-0 rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 py-2 text-sm text-on-surface placeholder:text-outline focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
export const labelClass = "mb-1 block text-[10px] font-bold uppercase tracking-wider text-outline"

export const Money: React.FC<{ amount: number; currency: string; tone?: "auto" | "plain"; className?: string }> = ({ amount, currency, tone = "plain", className = "" }) => (
  <span className={`tabular-nums ${tone === "auto" && amount < 0 ? "text-error" : ""} ${className}`}>{formatMoney(amount, currency)}</span>
)

export const StatCard: React.FC<{ label: string; amount: number; currency: string; hint?: string; tone?: "primary" | "success" | "error" | "plain" }> = ({
  label,
  amount,
  currency,
  hint,
  tone = "plain",
}) => {
  const tones = {
    primary: "border-primary/30 bg-primary/5",
    success: "border-success/30 bg-success-container/40",
    error: "border-error/30 bg-error-container/40",
    plain: "border-outline-variant bg-surface-container-lowest",
  }
  return (
    <div className={`min-w-0 rounded-2xl border p-3 sm:p-4 ${tones[tone]}`}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</p>
      <p className={`mt-1 break-words text-base font-bold tabular-nums sm:text-xl ${amount < 0 ? "text-error" : "text-on-surface"}`}>{formatMoney(amount, currency)}</p>
      {hint && <p className="mt-0.5 text-[11px] text-on-surface-variant">{hint}</p>}
    </div>
  )
}

export const Breakdown: React.FC<{ title: string; rows: BreakdownRow[]; currency: string; limit?: number }> = ({ title, rows, currency, limit = 8 }) => {
  const top = rows.slice(0, limit)
  const largest = Math.max(1, ...top.map((row) => row.amount))
  return (
    <section className="min-w-0 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
      <h3 className="text-sm font-bold text-on-surface">{title}</h3>
      {top.length === 0 ? (
        <p className="mt-2 text-[12px] text-on-surface-variant">Nothing yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {top.map((row) => (
            <li key={row.label} className="min-w-0">
              <div className="flex items-baseline justify-between gap-3 text-[12px]">
                <span className="min-w-0 break-words font-semibold text-on-surface">
                  {row.label} <span className="font-normal text-outline">· {row.count}</span>
                </span>
                <Money amount={row.amount} currency={currency} className="shrink-0 text-on-surface-variant" />
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-container-high" aria-hidden="true">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (row.amount / largest) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {rows.length > limit && <p className="mt-2 text-[11px] text-outline">and {rows.length - limit} more</p>}
    </section>
  )
}

/** A labelled field inside an editable row; the label is always there, so a row reads the same on a phone. */
export const RowField: React.FC<{ label: string; className?: string; children: React.ReactNode }> = ({ label, className = "", children }) => (
  <label className={`block min-w-0 ${className}`}>
    <span className={labelClass}>{label}</span>
    {children}
  </label>
)

/** An amount typed as a number; an empty or half-typed box reads as 0 rather than breaking a total. */
export const AmountInput: React.FC<{ value: number; onChange: (value: number) => void; disabled?: boolean; ariaLabel?: string }> = ({ value, onChange, disabled, ariaLabel }) => (
  <input
    type="number"
    inputMode="decimal"
    min={0}
    step="any"
    value={value === 0 ? "" : value}
    placeholder="0"
    aria-label={ariaLabel}
    onChange={(event) => {
      const typed = Number(event.target.value)
      onChange(Number.isFinite(typed) && typed >= 0 ? typed : 0)
    }}
    disabled={disabled}
    className={`${fieldClass} tabular-nums`}
  />
)

export const CurrencyInput: React.FC<{ value: string; onChange: (value: string) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => (
  <input
    value={value}
    list="budget-currencies"
    maxLength={3}
    onChange={(event) => onChange(event.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
    disabled={disabled}
    className={`${fieldClass} uppercase`}
  />
)

/** The suggestion lists every editable row points at (`list="budget-…"`), filled from what was typed before. */
export const BudgetSuggestions: React.FC<{ suggestions: Record<string, string[]> }> = ({ suggestions }) => (
  <>
    <datalist id="budget-currencies">
      {COMMON_CURRENCIES.map((code) => (
        <option key={code} value={code} />
      ))}
    </datalist>
    {Object.entries(suggestions).map(([key, values]) => (
      <datalist key={key} id={`budget-${key}`}>
        {values.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>
    ))}
  </>
)

/** Saves text as a file in the browser: the spreadsheet exports. */
export function downloadText(fileName: string, text: string, type = "text/csv;charset=utf-8") {
  // A BOM, so a spreadsheet opens the file as UTF-8 and keeps every name as it was written
  const blob = new Blob(["﻿", text], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
