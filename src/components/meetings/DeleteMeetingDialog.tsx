"use client"

import React, { useRef } from "react"
import { Loader2, Trash2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import type { MeetingSummary } from "@/types/meetings"

interface DeleteMeetingDialogProps {
  meeting: MeetingSummary
  isDeleting: boolean
  error: string | null
  onConfirm: () => void
  onClose: () => void
}

/**
 * Asks before deleting one meeting, naming it and saying that the transcript goes with it.
 * Nothing is deleted until Delete is pressed; Escape, the backdrop and Cancel all close it.
 */
export const DeleteMeetingDialog: React.FC<DeleteMeetingDialogProps> = ({ meeting, isDeleting, error, onConfirm, onClose }) => {
  const cancelRef = useRef<HTMLButtonElement>(null)

  return (
    <Modal
      title="Delete this meeting?"
      description={`"${meeting.title}" and its transcript will be deleted for good. It cannot be undone.`}
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
              {isDeleting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Trash2 size={16} aria-hidden="true" />}
              {isDeleting ? "Deleting..." : "Delete meeting"}
            </button>
          </div>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-on-surface-variant">
        The notes, the analysis and everything read from the transcript go together. Copy anything you still need first.
      </p>
    </Modal>
  )
}
