"use client"

import React from "react"
import { RotateCcw } from "lucide-react"

interface ResetButtonProps {
  onReset: () => void
  // Nothing to clear yet
  disabled?: boolean
}

/**
 * The page-header button every tool uses to start over: it clears the inputs, the
 * selections and the result (cancelling a request that's still running).
 */
export const ResetButton: React.FC<ResetButtonProps> = ({ onReset, disabled = false }) => (
  <button
    type="button"
    onClick={onReset}
    disabled={disabled}
    title="Clear the inputs and the result"
    className="flex-1 sm:flex-none inline-flex items-center justify-center whitespace-nowrap gap-2 px-4 py-2.5 border border-outline-variant bg-white text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
  >
    <RotateCcw size={16} aria-hidden="true" />
    Reset
  </button>
)
