"use client"

import React, { useState } from "react"
import { FolderKanban, Info, Pencil, Plus, Trash2 } from "lucide-react"
import { ProjectFormDialog } from "@/components/my-profile/ProjectFormDialog"
import { createToolStore, useToolStore } from "@/lib/toolStore"
import { PROFILE_PROJECT_MESSAGES, PROJECT_FIELDS, PROJECT_LIMITS } from "@/constants/profileProjects"
import type { ProfileProject } from "@/types/profileProjects"

/**
 * The projects, kept in this browser until saving them to the account is built. `remember` keeps
 * them with no expiry, the way a standing choice is kept, rather than for the 24 hours a piece of
 * work is; signing out clears them with every other tool's state.
 */
const projectsStore = createToolStore<{ projects: ProfileProject[] }>("my-profile:projects", { projects: [] }, { version: 1, remember: ["projects"] })

const List: React.FC<{ title: string; items: string[] }> = ({ title, items }) =>
  items.length === 0 ? null : (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] font-bold uppercase tracking-wider text-outline">{title}</p>
      <ul className="flex list-disc flex-col gap-0.5 pl-5 text-[13px] text-on-surface">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )

const ProjectCard: React.FC<{ project: ProfileProject; onEdit: () => void; onRemove: () => void }> = ({ project, onEdit, onRemove }) => {
  const [isConfirming, setIsConfirming] = useState(false)
  return (
    <article aria-labelledby={`project-${project.id}`} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 id={`project-${project.id}`} className="min-w-0 text-[16px] font-bold text-on-surface [overflow-wrap:anywhere]">
          {project.name}
        </h3>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-primary">
            <Pencil size={13} aria-hidden="true" />
            Edit
          </button>
          {/* Removing asks once more on the button itself, so one slip of the mouse never loses a project */}
          <button
            type="button"
            onClick={() => (isConfirming ? onRemove() : setIsConfirming(true))}
            onBlur={() => setIsConfirming(false)}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold ${
              isConfirming ? "bg-error text-white" : "text-on-surface-variant hover:bg-error-container hover:text-error"
            }`}
          >
            <Trash2 size={13} aria-hidden="true" />
            {isConfirming ? PROFILE_PROJECT_MESSAGES.removeConfirm : PROFILE_PROJECT_MESSAGES.remove}
          </button>
        </div>
      </div>

      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-on-surface-variant [overflow-wrap:anywhere]">{project.summary}</p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <List title={PROJECT_FIELDS.highlights.label} items={project.highlights} />
        <List title={PROJECT_FIELDS.bestMatches.label} items={project.bestMatches} />
      </div>

      {project.proposalMatches.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-outline">{PROJECT_FIELDS.proposalMatches.label}</p>
          <ul className="flex flex-col gap-1.5">
            {project.proposalMatches.map((match) => (
              <li key={`${match.need}-${match.emphasize}`} className="rounded-xl bg-surface-container-lowest px-3 py-2 text-[13px] text-on-surface">
                <span className="font-semibold">If the client needs {match.need}</span>
                <span className="text-on-surface-variant"> → emphasize {match.emphasize}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {project.keywords.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={PROJECT_FIELDS.keywords.label}>
          {project.keywords.map((word) => (
            <li key={word} className="rounded-full bg-primary-fixed px-2.5 py-1 text-[12px] font-semibold text-primary">
              {word}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

/**
 * My AI Profile → Projects: the work this person can point to, one card per project, with Add,
 * Edit and Remove. The interface only, for now (constants/profileProjects.ts): the projects stay in
 * this browser and no tool reads them yet, which the notice at the top says plainly.
 */
export const ProjectsTab: React.FC = () => {
  const { projects } = useToolStore(projectsStore)
  // undefined: the form is closed; null: adding; a project: editing that one
  const [editing, setEditing] = useState<ProfileProject | null | undefined>(undefined)
  const isFull = projects.length >= PROJECT_LIMITS.projects

  const save = (project: ProfileProject) => {
    projectsStore.update((current) => ({
      projects: current.projects.some((kept) => kept.id === project.id)
        ? current.projects.map((kept) => (kept.id === project.id ? project : kept))
        : [project, ...current.projects],
    }))
    setEditing(undefined)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex min-w-0 flex-1 items-start gap-2 rounded-xl border border-secondary/30 bg-secondary-fixed px-3 py-2 text-[13px] leading-relaxed text-on-secondary-fixed-variant">
          <Info size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          {PROFILE_PROJECT_MESSAGES.notSavedYet}
        </p>
        <button
          type="button"
          onClick={() => setEditing(null)}
          disabled={isFull}
          title={isFull ? PROFILE_PROJECT_MESSAGES.tooMany : undefined}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          <Plus size={16} aria-hidden="true" />
          {PROFILE_PROJECT_MESSAGES.add}
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-12 text-center">
          <FolderKanban size={28} className="text-primary" aria-hidden="true" />
          <p className="max-w-md text-[14px] text-on-surface-variant">{PROFILE_PROJECT_MESSAGES.empty}</p>
          <button type="button" onClick={() => setEditing(null)} className="inline-flex items-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container-high">
            <Plus size={16} aria-hidden="true" />
            {PROFILE_PROJECT_MESSAGES.add}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={() => setEditing(project)}
              onRemove={() => projectsStore.update((current) => ({ projects: current.projects.filter((kept) => kept.id !== project.id) }))}
            />
          ))}
        </div>
      )}

      {editing !== undefined && <ProjectFormDialog editing={editing} onSave={save} onClose={() => setEditing(undefined)} />}
    </div>
  )
}
