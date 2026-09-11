"use client"

import React from "react"
import { FlaskConical } from "lucide-react"

/**
 * The page-header button every tool uses to open its Dummy Data popup.
 */
export const DummyDataButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    title="Load, copy or edit sample data for this tool"
    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-outline-variant bg-white text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-colors"
  >
    <FlaskConical size={16} aria-hidden="true" />
    Dummy Data
  </button>
)
