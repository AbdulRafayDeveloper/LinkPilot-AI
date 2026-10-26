"use client"

import React from "react"
import { Lock } from "lucide-react"
import { PROJECT_ITEM_KINDS, PROJECT_TASK_MESSAGES, type ProjectItemKind } from "@/constants/clientProjectTasks"
import type { ProjectItemCount } from "@/types/clientProjectTasks"

type ItemKind = (typeof PROJECT_ITEM_KINDS)[number]

interface ProjectTabsProps {
  chosen: ProjectItemKind
  onChoose: (kind: ProjectItemKind) => void
  // How each tab stands, so the counts are on the tabs themselves rather than only inside them
  counts: Record<ProjectItemKind, ProjectItemCount>
  /**
   * Which tabs to show. Left out it is every one of them, which is the owner's page; a shared link
   * passes `PUBLIC_ITEM_KINDS`, so the private tabs are not offered there at all.
   */
  kinds?: readonly ItemKind[]
}

interface TabProps {
  kind: ItemKind
  isChosen: boolean
  count: ProjectItemCount
  onChoose: (kind: ProjectItemKind) => void
  isPrivate: boolean
}

const Tab: React.FC<TabProps> = ({ kind, isChosen, count, onChoose, isPrivate }) => {
  // A private tab wears the gold accent, so it is never mistaken for one the client can see
  const tone = isPrivate
    ? isChosen
      ? "bg-secondary text-white"
      : "text-on-secondary-fixed-variant hover:bg-secondary-fixed-dim/70"
    : isChosen
      ? "bg-primary text-white"
      : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
  const countTone = isChosen ? "bg-white/20 text-white" : isPrivate ? "bg-secondary-fixed-dim text-on-secondary-fixed-variant" : "bg-surface-container-high text-outline"
  return (
    <button
      type="button"
      role="tab"
      id={`project-tab-${kind.id}`}
      aria-selected={isChosen}
      aria-controls={`project-panel-${kind.id}`}
      onClick={() => onChoose(kind.id)}
      // Each tab is as wide as its own label and they wrap onto another line when there is no room
      className={`inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:px-4 ${tone}`}
    >
      {kind.label}
      {count.total > 0 && (
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${countTone}`}>{count.done > 0 ? `${count.done}/${count.total}` : count.total}</span>
      )}
    </button>
  )
}

/**
 * The tabs a project's items sit under. The tabs a shared link shows come first, **in exactly the
 * order the link shows them** (`PROJECT_ITEM_KINDS` order), so the owner and the client read the
 * project the same way. The tabs only the owner sees (Credentials, Backups, Team Members) follow as
 * one group of their own, set apart in gold under a lock and "Only you", so what the client can
 * never see is plain at a glance. On the shared link that group is empty and is not drawn.
 *
 * It is a real tab strip for a screen reader (`role="tablist"`, each tab owning the panel its items
 * are in), and each tab carries its own count.
 */
export const ProjectTabs: React.FC<ProjectTabsProps> = ({ chosen, onChoose, counts, kinds = PROJECT_ITEM_KINDS }) => {
  const shared = kinds.filter((kind) => kind.isPublic)
  const own = kinds.filter((kind) => !kind.isPublic)
  return (
    <div role="tablist" aria-label="What this project holds" className="flex flex-wrap items-center gap-1 rounded-2xl border border-outline-variant bg-white p-1">
      {shared.map((kind) => (
        <Tab key={kind.id} kind={kind} isChosen={kind.id === chosen} count={counts[kind.id]} onChoose={onChoose} isPrivate={false} />
      ))}
      {own.length > 0 && (
        <div
          role="group"
          aria-label={PROJECT_TASK_MESSAGES.privateTabsLabel}
          title={PROJECT_TASK_MESSAGES.privateTabsHint}
          className="flex flex-wrap items-center gap-1 rounded-xl border border-dashed border-secondary/50 bg-secondary-fixed/60 p-0.5 pl-2"
        >
          <span className="inline-flex items-center gap-1 pr-1 text-[10px] font-bold uppercase tracking-wider text-on-secondary-fixed-variant">
            <Lock size={11} aria-hidden="true" />
            {PROJECT_TASK_MESSAGES.privateTabsLabel}
          </span>
          {own.map((kind) => (
            <Tab key={kind.id} kind={kind} isChosen={kind.id === chosen} count={counts[kind.id]} onChoose={onChoose} isPrivate />
          ))}
        </div>
      )}
    </div>
  )
}
