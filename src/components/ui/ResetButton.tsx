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
 *
 * **It is the icon alone**, at the owner's request: the arrow says what it does faster than the
 * word did and leaves the room to the buttons whose names cannot be guessed (Update Prompt, Dummy
 * Data, Clients). What the word carried is still there for anyone who needs it, as the tooltip and
 * as the name a screen reader reads out, and the square is 42px, the height of the buttons beside
 * it and well over the 24px a tap target must be.
 */
export const ResetButton: React.FC<ResetButtonProps> = ({ onReset, disabled = false }) => (
  <button
    type="button"
    onClick={onReset}
    disabled={disabled}
    title="Reset: clear the inputs and the result"
    aria-label="Reset"
    className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-surface-container-lowest"
  >
    <RotateCcw size={18} aria-hidden="true" />
  </button>
)
