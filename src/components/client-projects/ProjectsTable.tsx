"use client"

import React from "react"
import Link from "next/link"
import { ArrowRight, Building2, Link2, User } from "lucide-react"
import { SortableList } from "@/components/ui/SortableList"
import { historyLabelClass } from "@/components/history/HistoryFilters"
import { totalItems, workItems } from "@/lib/projectItems"
import { PROJECT_TASK_MESSAGES } from "@/constants/clientProjectTasks"
import { CLIENT_KINDS } from "@/constants/clients"
import { ProjectStatusBadge } from "@/components/clients/ProjectStatusBadge"
import type { ProjectWithTasks } from "@/types/clientProjectTasks"

interface ProjectsTableProps {
  projects: ProjectWithTasks[]
  // The whole list in its new order after a drop, top to bottom
  onReorder: (ids: string[]) => void
  // Off while a filter narrows the list, since a part of the list is not the whole order
  canDrag: boolean
}

// The table's columns, shared by the heading and every row so the two can never drift apart
const COLUMNS = "grid grid-cols-[28px_minmax(0,1fr)_160px_130px_130px_96px] items-start gap-x-3"

/** Whose project it is: the client's name and whether they are one person or a business. */
const ClientName: React.FC<{ project: ProjectWithTasks; prefix?: string }> = ({ project, prefix = "" }) => {
  const kind = CLIENT_KINDS.find((entry) => entry.id === project.clientKind)
  const Icon = project.clientKind === "company" ? Building2 : User
  return (
    <span className="flex min-w-0 flex-col gap-0.5 text-[12px] text-on-surface-variant">
      <span className="[overflow-wrap:anywhere]">
        {prefix}
        {project.clientName}
      </span>
      {kind && (
        <span className="inline-flex items-center gap-1 text-[11px] text-outline">
          <Icon size={11} className="shrink-0" aria-hidden="true" />
          {kind.label}
        </span>
      )}
    </span>
  )
}

// Where a project stands, the one badge every surface draws
const Status: React.FC<{ project: ProjectWithTasks }> = ({ project }) => <ProjectStatusBadge status={project.status} className="whitespace-nowrap" />

/**
 * How the project stands at a glance. **Only what can be ticked off is "done"**: a credential, a
 * link, a document or a backup is kept rather than finished, so those are counted as what the
 * project holds (see `workItems` / `totalItems`).
 */
const Standing: React.FC<{ project: ProjectWithTasks }> = ({ project }) => {
  const work = workItems(project.counts)
  const held = totalItems(project.counts)
  const kept = held.total - work.total
  return (
    <span className="flex flex-col gap-0.5 text-[12px] text-on-surface-variant">
      {work.total > 0 ? (
        <span className="whitespace-nowrap font-semibold text-on-surface">
          {work.done} of {work.total} done
        </span>
      ) : held.total === 0 ? (
        <span className="text-outline">{PROJECT_TASK_MESSAGES.nothingOnIt}</span>
      ) : null}
      {kept > 0 && <span className="whitespace-nowrap text-outline">{kept} kept</span>}
    </span>
  )
}

const manageButton =
  "inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-xl bg-primary px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"

const Manage: React.FC<{ project: ProjectWithTasks }> = ({ project }) => (
  <Link href={`/client-projects/${project.id}`} aria-label={PROJECT_TASK_MESSAGES.manageOne(project.name)} className={manageButton}>
    {PROJECT_TASK_MESSAGES.manage}
    <ArrowRight size={13} aria-hidden="true" />
  </Link>
)

/** The mark on a project whose link is on, so a shared project is told from a private one. */
const Shared: React.FC<{ project: ProjectWithTasks }> = ({ project }) =>
  project.publicToken ? (
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-primary-fixed px-2 py-0.5 text-[10px] font-semibold text-on-primary-fixed-variant">
      <Link2 size={10} aria-hidden="true" />
      {PROJECT_TASK_MESSAGES.shared}
    </span>
  ) : null

/**
 * Every client project in one list that reads as a table from `xl` (its 880px fits the room a page
 * has there) and as cards below it: what it is, whose it is and whether that client is a person or a
 * company, where it stands, and **Manage**, which opens that project's own page.
 *
 * **Every row is dragged into the order the projects are worked in** by its handle (the shared
 * `SortableList`: mouse, touch and the arrow keys). It is one list for both layouts, because a
 * `<table>` cannot be dragged, so the table's columns are a grid each row repeats.
 */
export const ProjectsTable: React.FC<ProjectsTableProps> = ({ projects, onReorder, canDrag }) => (
  <div className="flex flex-col gap-2">
    <p className="text-[12px] text-outline">{canDrag ? PROJECT_TASK_MESSAGES.dragProjects : PROJECT_TASK_MESSAGES.dragOffWhileFiltered}</p>
    <div className="overflow-hidden xl:rounded-2xl xl:border xl:border-outline-variant xl:bg-surface-container-lowest xl:shadow-sm">
      <div role="presentation" className={`hidden border-b border-outline-variant px-3 py-2.5 xl:grid ${COLUMNS}`}>
        <span />
        {["Project", "Client", "Status", "What is on it", "Actions"].map((heading) => (
          <span key={heading} className={historyLabelClass}>
            {heading}
          </span>
        ))}
      </div>
      <SortableList
        items={projects}
        getId={(project) => project.id}
        getLabel={(project) => `${project.name} for ${project.clientName}`}
        onReorder={onReorder}
        disabled={!canDrag}
        label="Every client project, in order"
        itemNoun="projects"
        className="flex flex-col gap-3 xl:gap-0"
        renderItem={(project, handle) => (
          <>
            {/* A table row from xl */}
            <div className={`hidden border-b border-outline-variant/60 bg-surface-container-lowest px-3 py-2.5 transition-colors hover:bg-surface-container-low xl:grid ${COLUMNS} [overflow-wrap:anywhere]`}>
              <span className="pt-0.5">{handle}</span>
              <div className="min-w-0">
                <Link
                  href={`/client-projects/${project.id}`}
                  className="inline-flex min-h-6 items-center text-[13px] font-bold text-on-surface transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {project.name}
                </Link>
                {project.description && <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-on-surface-variant">{project.description}</p>}
              </div>
              <ClientName project={project} />
              <span className="flex flex-wrap items-center gap-1">
                <Status project={project} />
                <Shared project={project} />
              </span>
              <Standing project={project} />
              <Manage project={project} />
            </div>

            {/* A card below xl */}
            <div className="flex min-w-0 flex-col gap-2 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm xl:hidden">
              <div className="flex items-start gap-2">
                <span className="-ml-1 shrink-0">{handle}</span>
                <Link
                  href={`/client-projects/${project.id}`}
                  className="flex min-h-6 min-w-0 flex-1 items-center break-words text-sm font-bold text-on-surface transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {project.name}
                </Link>
                <Status project={project} />
              </div>
              <ClientName project={project} prefix="For " />
              {project.description && <p className="line-clamp-3 text-[12px] leading-relaxed text-on-surface-variant">{project.description}</p>}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/70 pt-2">
                <span className="flex flex-wrap items-center gap-2">
                  <Standing project={project} />
                  <Shared project={project} />
                </span>
                <Manage project={project} />
              </div>
            </div>
          </>
        )}
      />
    </div>
  </div>
)
