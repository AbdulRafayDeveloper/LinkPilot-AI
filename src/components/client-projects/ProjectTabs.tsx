"use client"

import React from "react"
import { PROJECT_ITEM_KINDS, type ProjectItemKind } from "@/constants/clientProjectTasks"
import type { ProjectItemCount } from "@/types/clientProjectTasks"

interface ProjectTabsProps {
  chosen: ProjectItemKind
  onChoose: (kind: ProjectItemKind) => void
  // How each tab stands, so the counts are on the tabs themselves rather than only inside them
  counts: Record<ProjectItemKind, ProjectItemCount>
}

/**
 * The three tabs a project's items sit under: Changes, Ideas and Discussion, in `PROJECT_ITEM_KINDS`
 * order, with Changes first and chosen by default. The same strip serves the owner's page and the
 * shared link, so a client sees the project laid out exactly as its owner does.
 *
 * It is a real tab strip for a screen reader (`role="tablist"`, each tab owning the panel its items
 * are in), and each tab carries its own count, so how much is on the other two is readable without
 * opening them.
 */
export const ProjectTabs: React.FC<ProjectTabsProps> = ({ chosen, onChoose, counts }) => (
  <div role="tablist" aria-label="What this project holds" className="flex flex-wrap gap-1 rounded-2xl border border-outline-variant bg-white p-1">
    {PROJECT_ITEM_KINDS.map((kind) => {
      const isChosen = kind.id === chosen
      const count = counts[kind.id]
      return (
        <button
          key={kind.id}
          type="button"
          role="tab"
          id={`project-tab-${kind.id}`}
          aria-selected={isChosen}
          aria-controls={`project-panel-${kind.id}`}
          onClick={() => onChoose(kind.id)}
          // Three equal tabs across a phone, then each one only as wide as its own label, so a
          // full-width page (the shared link) never stretches three buttons across the screen
          className={`inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:flex-none sm:px-5 ${
            isChosen ? "bg-primary text-white" : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          }`}
        >
          {kind.label}
          {count.total > 0 && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isChosen ? "bg-white/20 text-white" : "bg-surface-container-high text-outline"}`}
            >
              {count.done > 0 ? `${count.done}/${count.total}` : count.total}
            </span>
          )}
        </button>
      )
    })}
  </div>
)
