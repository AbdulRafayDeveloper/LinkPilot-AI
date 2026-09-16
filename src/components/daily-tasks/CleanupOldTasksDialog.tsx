"use client"

import React, { useRef } from "react"
import { Loader2, Trash2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { VISIBLE_DAYS } from "@/constants/dailyTasks"

interface CleanupOldTasksDialogProps {
  // How many tasks sit outside the seven-day window, so the dialog says exactly what goes
  total: number
  // The oldest day that is kept
  windowStart: string
  isDeleting: boolean
  error: string | null
  onConfirm: () => void
  onClose: () => void
}

/**
 * Asks before deleting the tasks that are older than a week. Nothing is deleted until Delete is
 * pressed, and it cannot be pressed twice: Escape, the backdrop and Cancel all close it untouched.
 */
export const CleanupOldTasksDialog: React.FC<CleanupOldTasksDialogProps> = ({
  total,
  windowStart,
  isDeleting,
  error,
  onConfirm,
  onClose,
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null)

  return (
    <Modal
      title="Delete tasks older than one week?"
      description={`This deletes ${total.toLocaleString()} ${total === 1 ? "task" : "tasks"} for good. It cannot be undone.`}
      onClose={onClose}
      isCloseDisabled={isDeleting}
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
              disabled={isDeleting}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-error px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-error/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDeleting ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 size={16} aria-hidden="true" />
              )}
              {isDeleting ? "Deleting..." : "Delete older tasks"}
            </button>
          </div>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-on-surface-variant">
        Every task from before <span className="font-semibold text-on-surface">{windowStart}</span> will be removed from the
        database, finished or not. The last {VISIBLE_DAYS} days stay exactly as they are, and nothing else in the app is
        touched.
      </p>
    </Modal>
  )
}
