"use client"

import React from "react"
import Link from "next/link"
import { ArrowRight, Link2 } from "lucide-react"
import { historyLabelClass } from "@/components/history/HistoryFilters"
import { totalItems, workItems } from "@/lib/projectItems"
import { PROJECT_TASK_MESSAGES } from "@/constants/clientProjectTasks"
import type { ProjectWithTasks } from "@/types/clientProjectTasks"

interface ProjectsTableProps {
  projects: ProjectWithTasks[]
}

/** Where a project stands: still being worked on, or delivered and closed. */
const Status: React.FC<{ project: ProjectWithTasks }> = ({ project }) => (
  <span
    className={`inline-block shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${
      project.status === "completed" ? "bg-success-container text-on-success-container" : "bg-secondary-fixed text-on-secondary-fixed-variant"
    }`}
  >
    {project.status === "completed" ? "Completed" : "Active"}
  </span>
)

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
  "inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-xl bg-primary px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"

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
 * Every client project in one table: what it is, whose it is, where it stands, and **Manage**, which
 * opens that project's own page. The work itself (the tabs, the folders, the files) is done there
 * rather than beside this list, so the page stays a list however many projects there are.
 *
 * A table from `xl`, where its 880px fits the room a page has, and the same projects as cards below
 * that (see the Responsive layout rules in CLAUDE.md). The name is the link either way.
 */
export const ProjectsTable: React.FC<ProjectsTableProps> = ({ projects }) => (
  <>
    <div className="hidden overflow-x-auto rounded-2xl border border-outline-variant bg-white shadow-sm xl:block">
      <table className="w-full min-w-[880px] border-collapse text-left [overflow-wrap:anywhere]">
        <caption className="sr-only">Every client project</caption>
        <thead className="bg-surface-container-lowest">
          <tr className="border-b border-outline-variant">
            {["Project", "Client", "Status", "What is on it", "Actions"].map((heading) => (
              <th key={heading} scope="col" className={`px-3 py-2.5 ${historyLabelClass}`}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id} className="border-b border-outline-variant/60 align-top transition-colors last:border-0 hover:bg-surface-container-lowest">
              <td className="min-w-[260px] px-3 py-2.5">
                <Link
                  href={`/client-projects/${project.id}`}
                  className="inline-flex min-h-6 items-center text-[13px] font-bold text-on-surface transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {project.name}
                </Link>
                {project.description && <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-on-surface-variant">{project.description}</p>}
              </td>
              <td className="w-[180px] px-3 py-2.5 text-[12px] text-on-surface-variant">{project.clientName}</td>
              <td className="w-[150px] px-3 py-2.5">
                <span className="flex flex-wrap items-center gap-1">
                  <Status project={project} />
                  <Shared project={project} />
                </span>
              </td>
              <td className="w-[150px] px-3 py-2.5">
                <Standing project={project} />
              </td>
              <td className="w-[130px] px-3 py-2.5">
                <Manage project={project} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Cards on a phone, two to a row on a tablet or a narrow laptop */}
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:hidden">
      {projects.map((project) => (
        <li key={project.id} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-outline-variant bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/client-projects/${project.id}`}
              className="flex min-h-6 min-w-0 items-center break-words text-sm font-bold text-on-surface transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {project.name}
            </Link>
            <Status project={project} />
          </div>
          <p className="text-[12px] text-on-surface-variant">For {project.clientName}</p>
          {project.description && <p className="line-clamp-3 text-[12px] leading-relaxed text-on-surface-variant">{project.description}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/70 pt-2">
            <span className="flex flex-wrap items-center gap-2">
              <Standing project={project} />
              <Shared project={project} />
            </span>
            <Manage project={project} />
          </div>
        </li>
      ))}
    </ul>
  </>
)
