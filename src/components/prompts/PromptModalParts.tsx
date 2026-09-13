"use client"

import React from "react"
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"

export interface PromptFeedback {
  type: "success" | "error"
  message: string
}

interface PromptModalFooterProps {
  feedback: PromptFeedback | null
  // How many prompts (tabs) have unsaved edits; Save stores all of them
  unsavedCount: number
  isSaving: boolean
  canSave: boolean
  onCancel: () => void
  onSave: () => void
}

export const PromptModalFooter: React.FC<PromptModalFooterProps> = ({
  feedback,
  unsavedCount,
  isSaving,
  canSave,
  onCancel,
  onSave,
}) => (
  <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
    <div className="min-h-[20px] text-xs" aria-live="polite">
      {feedback && (
        <p
          role={feedback.type === "error" ? "alert" : "status"}
          className={`flex items-start gap-1.5 ${feedback.type === "error" ? "text-error" : "text-primary"}`}
        >
          {feedback.type === "error" ? (
            <AlertTriangle size={14} className="shrink-0 mt-px" aria-hidden="true" />
          ) : (
            <CheckCircle2 size={14} className="shrink-0 mt-px" aria-hidden="true" />
          )}
          <span>{feedback.message}</span>
        </p>
      )}
    </div>
    <div className="flex gap-2 sm:shrink-0">
      <button
        type="button"
        onClick={onCancel}
        disabled={isSaving}
        className="flex-1 sm:flex-none px-4 py-2 border border-outline-variant rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50"
      >
        {unsavedCount > 0 ? "Cancel" : "Close"}
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={!canSave}
        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-on-primary-fixed-variant text-white rounded-xl text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSaving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
        {isSaving ? "Saving..." : unsavedCount > 1 ? `Save ${unsavedCount} Prompts` : "Save Prompt"}
      </button>
    </div>
  </div>
)

export const PromptLoading: React.FC<{ text?: string }> = ({ text = "Loading the active prompt..." }) => (
  <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-on-surface-variant">
    <Loader2 size={18} className="animate-spin text-primary" aria-hidden="true" />
    {text}
  </div>
)

export const PromptLoadFailed: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
    <p className="text-sm text-on-surface-variant">The saved prompts couldn&apos;t be loaded.</p>
    <button
      type="button"
      onClick={onRetry}
      className="px-4 py-2 border border-outline-variant rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-container-high transition-colors"
    >
      Try again
    </button>
  </div>
)
