"use client"

import React from "react"
import { PROJECT_ITEM_KINDS, type ProjectItemKind } from "@/constants/clientProjectTasks"
import type { ProjectItemCount } from "@/types/clientProjectTasks"

interface ProjectTabsProps {
  chosen: ProjectItemKind
  onChoose: (kind: ProjectItemKind) => void
  // How each tab stands, so the counts are on the tabs themselves rather than only inside them
  counts: Record<ProjectItemKind, ProjectItemCount>
  /**
   * Which tabs to show. Left out it is every one of them, which is the owner's page; a shared link
   * passes `PUBLIC_ITEM_KINDS`, so Credentials and Backups are not offered there at all.
   */
  kinds?: readonly (typeof PROJECT_ITEM_KINDS)[number][]
}

/**
 * The tabs a project's items sit under, in `PROJECT_ITEM_KINDS` order, with Changes first and
 * chosen by default. The same strip serves the owner's page and the shared link, so a client sees
 * the project laid out exactly as its owner does, **less the tabs the link never shows**: it is
 * given `PUBLIC_ITEM_KINDS`, which leaves Credentials and Backups out.
 *
 * It is a real tab strip for a screen reader (`role="tablist"`, each tab owning the panel its items
 * are in), and each tab carries its own count, so how much is on the other two is readable without
 * opening them.
 */
export const ProjectTabs: React.FC<ProjectTabsProps> = ({ chosen, onChoose, counts, kinds = PROJECT_ITEM_KINDS }) => (
  <div role="tablist" aria-label="What this project holds" className="flex flex-wrap gap-1 rounded-2xl border border-outline-variant bg-white p-1">
    {kinds.map((kind) => {
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
          // Each tab is as wide as its own label and they wrap onto another line when there is no
          // room, which is what seven of them need on a phone
          className={`inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:px-4 ${
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
