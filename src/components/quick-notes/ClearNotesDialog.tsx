"use client"

import React, { useRef } from "react"
import { Loader2, Trash2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"

interface ClearNotesDialogProps {
  // How many notes will go, so the dialog says exactly what is being deleted
  total: number
  isClearing: boolean
  error: string | null
  onConfirm: () => void
  onClose: () => void
}

/**
 * Asks before deleting every saved note. Nothing is deleted until Delete is pressed, and it
 * cannot be pressed twice: Escape, the backdrop and Cancel all close it without deleting.
 */
export const ClearNotesDialog: React.FC<ClearNotesDialogProps> = ({ total, isClearing, error, onConfirm, onClose }) => {
  const cancelRef = useRef<HTMLButtonElement>(null)

  return (
    <Modal
      title="Delete all saved notes?"
      description={`This deletes ${total.toLocaleString()} saved ${total === 1 ? "note" : "notes"} for good. It cannot be undone.`}
      onClose={onClose}
      isCloseDisabled={isClearing}
      size="compact"
      initialFocusRef={cancelRef}
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
            <button
              ref={cancelRef}
              type="button"
              onClick={onClose}
              disabled={isClearing}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isClearing}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-error px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-error/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isClearing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Trash2 size={16} aria-hidden="true" />}
              {isClearing ? "Deleting..." : "Delete all"}
            </button>
          </div>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-on-surface-variant">
        Every note in Temporary Quick Notes will be removed from the database. Nothing else in the app is touched, and there is no
        way to get them back, so copy anything you still need first.
      </p>
    </Modal>
  )
}
