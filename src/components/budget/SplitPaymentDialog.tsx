"use client"

import React, { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { BUDGET_LIMITS, BUDGET_MESSAGES } from "@/constants/budget"
import { formatMoney, newId } from "@/lib/budget"
import type { BudgetPayment, BudgetPaymentPart } from "@/types/budget"
import { AmountInput, RowField, fieldClass } from "./BudgetParts"

/**
 * Splits one payment between several clients or projects, for a single transfer that paid for more
 * than one ("Tolu + Usama"). The parts must add up to the payment exactly, or the report would count
 * money twice or not at all; with no parts the payment counts whole under its own client and project.
 */
export const SplitPaymentDialog: React.FC<{ payment: BudgetPayment; onSave: (parts: BudgetPaymentPart[]) => void; onClose: () => void }> = ({ payment, onSave, onClose }) => {
  const [parts, setParts] = useState<BudgetPaymentPart[]>(
    payment.parts.length > 0
      ? payment.parts
      : [
          { id: newId(), clientName: payment.clientName, projectName: payment.projectName, amount: payment.amount },
          { id: newId(), clientName: "", projectName: "", amount: 0 },
        ]
  )
  const sum = Math.round(parts.reduce((total, part) => total + part.amount, 0) * 100) / 100
  const difference = Math.round((payment.amount - sum) * 100) / 100
  const change = (id: string, patch: Partial<BudgetPaymentPart>) => setParts((current) => current.map((part) => (part.id === id ? { ...part, ...patch } : part)))

  return (
    <Modal
      title="Split this payment"
      description={`${formatMoney(payment.amount, payment.currency)} shared between clients or projects. The parts must add up to the payment.`}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className={`text-xs ${difference === 0 ? "text-on-surface-variant" : "text-error"}`} aria-live="polite">
            {difference === 0 ? "The parts add up to the payment." : `${BUDGET_MESSAGES.partsDontAdd} ${difference > 0 ? "Still to place" : "Over by"}: ${formatMoney(Math.abs(difference), payment.currency)}.`}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            {payment.parts.length > 0 && (
              <button type="button" onClick={() => onSave([])} className="whitespace-nowrap rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container-high">
                Remove the split
              </button>
            )}
            <button type="button" onClick={onClose} className="whitespace-nowrap rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container-high">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(parts.filter((part) => part.amount > 0 || part.clientName.trim() || part.projectName.trim()))}
              disabled={difference !== 0}
              className="whitespace-nowrap rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save the split
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        {parts.map((part, index) => (
          <div key={part.id} className="grid grid-cols-2 items-end gap-2 rounded-xl border border-outline-variant p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem_auto]">
            <RowField label={`Client ${index + 1}`}>
              <input value={part.clientName} list="budget-clients" onChange={(event) => change(part.id, { clientName: event.target.value })} className={fieldClass} />
            </RowField>
            <RowField label="Project">
              <input value={part.projectName} list="budget-projects" onChange={(event) => change(part.id, { projectName: event.target.value })} className={fieldClass} />
            </RowField>
            <RowField label="Amount">
              <AmountInput value={part.amount} onChange={(amount) => change(part.id, { amount })} />
            </RowField>
            <button
              type="button"
              onClick={() => setParts((current) => current.filter((entry) => entry.id !== part.id))}
              disabled={parts.length <= 1}
              aria-label={`Remove part ${index + 1}`}
              className="inline-flex h-9 w-9 items-center justify-center justify-self-end rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-error disabled:opacity-40"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setParts((current) => [...current, { id: newId(), clientName: "", projectName: "", amount: Math.max(0, difference) }])}
          disabled={parts.length >= BUDGET_LIMITS.parts}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-50"
        >
          <Plus size={16} aria-hidden="true" /> Add a part
        </button>
      </div>
    </Modal>
  )
}
