"use client"

import React, { useState } from "react"
import { Loader2, Plus, Save, Trash2, UserX } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { BUDGET_LIMITS, BUDGET_MESSAGES } from "@/constants/budget"
import { newId } from "@/lib/budget"
import type { BudgetMonth, BudgetSettings } from "@/types/budget"
import { AmountInput, CurrencyInput, RowField, fieldClass } from "./BudgetParts"

interface BudgetSettingsDialogProps {
  settings: BudgetSettings
  months: BudgetMonth[]
  isSaving: boolean
  error: string | null
  onSave: (settings: BudgetSettings) => void
  onClose: () => void
}

/**
 * What the calculations stand on: the currency everything is counted in, the balance before the first
 * month, how much of what is left after the fixed amounts stays in the business, and the people the
 * profit is shared with (two or more), each with the fixed amount a new month starts with and their
 * share of the additional distribution. Someone who already has amounts in a month is switched off
 * rather than removed, so those months still name them.
 */
export const BudgetSettingsDialog: React.FC<BudgetSettingsDialogProps> = ({ settings, months, isSaving, error, onSave, onClose }) => {
  const [draft, setDraft] = useState<BudgetSettings>(settings)
  const usedIds = new Set(months.flatMap((month) => [...Object.keys(month.fixed), ...Object.keys(month.additional ?? {})]))
  const missingName = draft.participants.some((participant) => !participant.name.trim())
  const changeParticipant = (id: string, patch: Partial<BudgetSettings["participants"][number]>) =>
    setDraft((current) => ({ ...current, participants: current.participants.map((participant) => (participant.id === id ? { ...participant, ...patch } : participant)) }))

  return (
    <Modal
      title="Budget settings"
      description="These apply to your budget only. A month keeps its own fixed amounts once it is recorded, so changing them here changes new months."
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
            {!error && missingName && <p className="text-on-surface-variant">{BUDGET_MESSAGES.participantMissing}</p>}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onClose} disabled={isSaving} className="whitespace-nowrap rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-50">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(draft)}
              disabled={isSaving || missingName || draft.baseCurrency.length !== 3}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
              Save settings
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <RowField label="Your currency">
            <CurrencyInput value={draft.baseCurrency} onChange={(baseCurrency) => setDraft((current) => ({ ...current, baseCurrency }))} disabled={isSaving} />
          </RowField>
          <RowField label="Balance before your first month">
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={draft.openingBalance}
              onChange={(event) => setDraft((current) => ({ ...current, openingBalance: Number(event.target.value) || 0 }))}
              disabled={isSaving}
              className={`${fieldClass} tabular-nums`}
            />
          </RowField>
          <RowField label="Kept in the business (%)">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={draft.reinvestPercent}
              onChange={(event) => setDraft((current) => ({ ...current, reinvestPercent: Math.min(100, Math.max(0, Number(event.target.value) || 0)) }))}
              disabled={isSaving}
              className={`${fieldClass} tabular-nums`}
            />
          </RowField>
        </div>
        <p className="-mt-3 text-[11px] text-on-surface-variant">
          Of what is left after the fixed amounts, {draft.reinvestPercent}% stays in the business and {100 - draft.reinvestPercent}% is shared as additional distribution.
        </p>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-on-surface">People the profit is shared with</h3>
          {draft.participants.map((participant) => {
            const isUsed = usedIds.has(participant.id)
            return (
              <div key={participant.id} className={`grid grid-cols-2 items-end gap-2 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_10rem_6rem_auto] ${participant.active ? "border-outline-variant" : "border-dashed border-outline-variant opacity-70"}`}>
                <RowField label="Name" className="col-span-2 sm:col-span-1">
                  <input value={participant.name} onChange={(event) => changeParticipant(participant.id, { name: event.target.value })} disabled={isSaving} maxLength={80} className={fieldClass} />
                </RowField>
                <RowField label="Fixed each month">
                  <AmountInput value={participant.fixedAmount} onChange={(fixedAmount) => changeParticipant(participant.id, { fixedAmount })} disabled={isSaving || !participant.active} />
                </RowField>
                <RowField label="Share">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={participant.share}
                    onChange={(event) => changeParticipant(participant.id, { share: Math.max(0, Number(event.target.value) || 0) })}
                    disabled={isSaving || !participant.active}
                    className={`${fieldClass} tabular-nums`}
                  />
                </RowField>
                {isUsed ? (
                  <button
                    type="button"
                    onClick={() => changeParticipant(participant.id, { active: !participant.active })}
                    disabled={isSaving}
                    title={BUDGET_MESSAGES.participantInUse}
                    className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-outline-variant px-2.5 text-[12px] font-semibold text-on-surface hover:bg-surface-container-high"
                  >
                    <UserX size={14} aria-hidden="true" /> {participant.active ? "Switch off" : "Switch on"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDraft((current) => ({ ...current, participants: current.participants.filter((entry) => entry.id !== participant.id) }))}
                    disabled={isSaving}
                    aria-label={`Remove ${participant.name || "this person"}`}
                    className="inline-flex h-9 w-9 items-center justify-center justify-self-end rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-error"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
            )
          })}
          <button
            type="button"
            onClick={() => setDraft((current) => ({ ...current, participants: [...current.participants, { id: newId(), name: "", fixedAmount: 0, share: 1, active: true }] }))}
            disabled={isSaving || draft.participants.length >= BUDGET_LIMITS.participants}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-50"
          >
            <Plus size={16} aria-hidden="true" /> Add a person
          </button>
          <p className="text-[11px] text-on-surface-variant">Equal shares split the additional distribution equally. Give someone 2 and another 1 to split it two to one.</p>
        </section>
      </div>
    </Modal>
  )
}
