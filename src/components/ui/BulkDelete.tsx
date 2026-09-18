"use client"

import React from "react"
import { Loader2, Trash2 } from "lucide-react"
import { Modal } from "./Modal"

/**
 * Deleting several records at once, the same way in every module that lists them: a bar offering the
 * ticked rows and everything the filters cover, and one confirmation that names the exact count.
 * Deleting is always final here, so nothing in this file acts without that confirmation.
 */

export interface BulkNoun {
  one: string
  many: string
}

const countLabel = (count: number, noun: BulkNoun) => `${count} ${count === 1 ? noun.one : noun.many}`

interface BulkDeleteBarProps {
  pickedCount: number
  // Everything the filters cover, across every page; null hides the "delete all" side
  total: number | null
  noun: BulkNoun
  // Whether any filter is on, so the bar can say "matching" rather than "saved"
  hasFilters?: boolean
  isBusy?: boolean
  onDeletePicked: () => void
  onDeleteAll?: () => void
  onClear: () => void
}

/** The bar above a list: what is ticked, and what the filters cover. */
export const BulkDeleteBar: React.FC<BulkDeleteBarProps> = ({
  pickedCount,
  total,
  noun,
  hasFilters = false,
  isBusy = false,
  onDeletePicked,
  onDeleteAll,
  onClear,
}) => {
  if (pickedCount === 0 && (total === null || total === 0)) return null
  const button =
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-50"
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2">
      <p className="text-[12px] text-on-surface-variant">
        {pickedCount > 0
          ? `${countLabel(pickedCount, noun)} picked.`
          : hasFilters
            ? `${countLabel(total ?? 0, noun)} match these filters.`
            : `${countLabel(total ?? 0, noun)} saved.`}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {pickedCount > 0 && (
          <>
            <button type="button" onClick={onDeletePicked} disabled={isBusy} className={`${button} border-error/40 text-error hover:bg-error/5`}>
              <Trash2 size={13} aria-hidden="true" />
              Delete {pickedCount} picked
            </button>
            <button type="button" onClick={onClear} disabled={isBusy} className={`${button} border-transparent text-primary hover:bg-primary/10`}>
              Clear
            </button>
          </>
        )}
        {onDeleteAll && total !== null && total > 0 && pickedCount === 0 && (
          <button type="button" onClick={onDeleteAll} disabled={isBusy} className={`${button} border-error/40 text-error hover:bg-error/5`}>
            <Trash2 size={13} aria-hidden="true" />
            {hasFilters ? `Delete all ${total} matching` : `Delete all ${total}`}
          </button>
        )}
      </div>
    </div>
  )
}

interface ConfirmBulkDeleteProps {
  count: number
  noun: BulkNoun
  // What goes with each record, when deleting one takes more than the row itself
  alsoGoes?: string
  isDeleting: boolean
  onConfirm: () => void
  onClose: () => void
}

/** The one confirmation every bulk delete goes through, naming exactly how many records go. */
export const ConfirmBulkDelete: React.FC<ConfirmBulkDeleteProps> = ({ count, noun, alsoGoes, isDeleting, onConfirm, onClose }) => (
  <Modal
    title={`Delete ${countLabel(count, noun)}?`}
    description="This cannot be undone."
    onClose={onClose}
    isCloseDisabled={isDeleting}
    size="compact"
    footer={
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isDeleting}
          className="inline-flex items-center justify-center rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
        >
          Keep {count === 1 ? "it" : "them"}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isDeleting}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-error px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-error/90 disabled:opacity-50"
        >
          {isDeleting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Trash2 size={16} aria-hidden="true" />}
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    }
  >
    <p className="text-sm leading-relaxed text-on-surface-variant">
      {count === 1 ? `This ${noun.one} is removed for good.` : `These ${count} ${noun.many} are removed for good.`}
      {alsoGoes ? ` ${alsoGoes}` : ""}
    </p>
  </Modal>
)
