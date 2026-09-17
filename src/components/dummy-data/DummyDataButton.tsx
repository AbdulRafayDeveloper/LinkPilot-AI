"use client"

import React from "react"
import { FlaskConical } from "lucide-react"
import { useIsAdmin } from "@/hooks/useCurrentUser"

/**
 * The page-header button every tool uses to open its Dummy Data popup. Dummy Data is for admins
 * only, so a user never sees the button (and the API refuses them anyway).
 */
export const DummyDataButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const isAdmin = useIsAdmin()
  if (!isAdmin) return null
  return (
    <button
      type="button"
      onClick={onClick}
      title="Load, copy or edit sample data for this tool"
      className="flex-1 sm:flex-none inline-flex items-center justify-center whitespace-nowrap gap-2 px-4 py-2.5 border border-outline-variant bg-white text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-colors"
    >
      <FlaskConical size={16} aria-hidden="true" />
      Dummy Data
    </button>
  )
}
