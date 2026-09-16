"use client"

import React, { useRef } from "react"
import { Loader2, Trash2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import type { Asset } from "@/types/importantFiles"

interface DeleteAssetDialogProps {
  asset: Asset
  isDeleting: boolean
  error: string | null
  onConfirm: () => void
  onClose: () => void
}

/**
 * Asks before deleting one file, naming it so the right one goes. Nothing is deleted until
 * Delete is pressed; Escape, the backdrop and Cancel all close it and leave the file alone.
 */
export const DeleteAssetDialog: React.FC<DeleteAssetDialogProps> = ({ asset, isDeleting, error, onConfirm, onClose }) => {
  const cancelRef = useRef<HTMLButtonElement>(null)

  return (
    <Modal
      title="Delete this file?"
      description={`"${asset.name}" will be removed from storage as well. It cannot be undone.`}
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
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-on-surface-variant">
        Download it first if you might still need it. Nothing else in the app is touched.
      </p>
    </Modal>
  )
}
