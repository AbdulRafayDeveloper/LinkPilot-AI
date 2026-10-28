import React from "react"
import { clientProjectStatus, type ClientProjectStatus } from "@/constants/clients"

/**
 * Where a project stands, as one chip: its word always, its colour as the second sign, so a status
 * never rests on colour alone. The one place a project's status is drawn (Clients Management, the
 * Client Projects list and page, and the client's shared link), so every status reads the same everywhere.
 */
const TONES: Record<ClientProjectStatus, { chip: string; dot: string }> = {
  discovery: { chip: "border border-outline-variant bg-surface-container-lowest text-on-surface-variant", dot: "bg-outline" },
  planning: { chip: "bg-surface-container-high text-on-surface-variant", dot: "bg-primary" },
  active: { chip: "bg-primary-fixed text-on-primary-fixed-variant", dot: "bg-primary" },
  "on-hold": { chip: "bg-secondary-fixed text-on-secondary-fixed-variant", dot: "bg-secondary" },
  maintenance: { chip: "border border-primary/40 bg-surface-container-lowest text-primary", dot: "bg-primary" },
  completed: { chip: "bg-success-container text-on-success-container", dot: "bg-success" },
  cancelled: { chip: "bg-error-container text-on-error-container", dot: "bg-error" },
}

export const ProjectStatusBadge: React.FC<{ status: string; className?: string }> = ({ status, className = "" }) => {
  const entry = clientProjectStatus(status)
  const tone = TONES[entry.id]
  return (
    <span
      title={entry.description}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone.chip} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
      {entry.label}
    </span>
  )
}
