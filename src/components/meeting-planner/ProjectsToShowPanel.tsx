"use client"

import React, { useState } from "react"
import { ExternalLink, Loader2, Pencil, Plus, Trash2, X } from "lucide-react"
import { SortableList } from "@/components/ui/SortableList"
import { requestApi } from "@/lib/apiClient"
import { isSafeHref } from "@/lib/richText"
import { normalizeProjectLink, scriptId } from "@/lib/meetingScript"
import {
  MAX_PROJECTS_TO_SHOW,
  MEETING_PLANNER_ENDPOINT,
  MEETING_PLANNER_MESSAGES,
  PROJECT_LINK_MAX_LENGTH,
  PROJECT_NOTE_MAX_LENGTH,
  SCRIPT_TITLE_MAX_LENGTH,
} from "@/constants/meetingPlanner"
import type { MeetingPlanDetail, ProjectToShow } from "@/types/meetingPlanner"

type Project = Required<ProjectToShow>

interface ProjectForm {
  // The project being edited, or null for a new one
  id: string | null
  project: string
  link: string
  note: string
}

const inputClass =
  "w-full rounded-lg border border-outline-variant bg-white px-3 py-2 text-[14px] text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"

interface ProjectsToShowPanelProps {
  meetingId: string
  projects: Project[]
  // A new preparation is being written; changes wait for it
  disabled: boolean
  onMeetingSaved: (meeting: MeetingPlanDetail) => void
}

/**
 * The projects to show in the meeting, in the order to show them. The user adds their own (with an
 * optional link to open during the call), edits or removes any, and drags them into order. What
 * the user adds or edits is kept, with its link, when the preparation is written again. Every
 * change saves the whole list at once.
 */
export const ProjectsToShowPanel: React.FC<ProjectsToShowPanelProps> = ({ meetingId, projects, disabled, onMeetingSaved }) => {
  const [form, setForm] = useState<ProjectForm | null>(null)
  // Shown straight away after a drag or a delete, until the saved meeting comes back
  const [pending, setPending] = useState<Project[] | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const list = pending ?? projects

  const persist = async (next: Project[], optimistic: boolean): Promise<boolean> => {
    setIsSaving(true)
    setError(null)
    if (optimistic) setPending(next)
    try {
      const { data } = await requestApi<MeetingPlanDetail>(`${MEETING_PLANNER_ENDPOINT}/${meetingId}/projects`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projects: next }),
      })
      onMeetingSaved(data)
      return true
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : MEETING_PLANNER_MESSAGES.projectsSaveFailed)
      return false
    } finally {
      setPending(null)
      setIsSaving(false)
    }
  }

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form || isSaving) return
    const name = form.project.trim()
    if (!name) {
      setError(MEETING_PLANNER_MESSAGES.projectNameMissing)
      return
    }
    const link = normalizeProjectLink(form.link)
    if (link && !/^https?:\/\/\S+$/i.test(link)) {
      setError(MEETING_PLANNER_MESSAGES.projectLinkInvalid)
      return
    }
    const entry: Project = {
      id: form.id ?? scriptId(),
      project: name,
      link,
      why_it_will_land: form.note.trim(),
      added_by_user: true,
    }
    const next = form.id ? list.map((item) => (item.id === form.id ? entry : item)) : [...list, entry]
    if (await persist(next, false)) setForm(null)
  }

  const canAdd = list.length < MAX_PROJECTS_TO_SHOW

  const renderForm = () =>
    form && (
      <form onSubmit={submitForm} className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-on-surface">
            Project name
            <input
              value={form.project}
              onChange={(event) => setForm({ ...form, project: event.target.value })}
              maxLength={SCRIPT_TITLE_MAX_LENGTH}
              placeholder="e.g. Okani Travels"
              autoFocus
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-on-surface">
            <span>
              Link <span className="font-normal text-outline">(optional)</span>
            </span>
            <input
              value={form.link}
              onChange={(event) => setForm({ ...form, link: event.target.value })}
              maxLength={PROJECT_LINK_MAX_LENGTH}
              placeholder="https://..."
              inputMode="url"
              className={inputClass}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-on-surface">
          <span>
            Why show it, or what to show <span className="font-normal text-outline">(optional)</span>
          </span>
          <textarea
            value={form.note}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
            maxLength={PROJECT_NOTE_MAX_LENGTH}
            rows={2}
            className={`${inputClass} resize-y`}
          />
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setForm(null)
              setError(null)
            }}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-[13px] font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-50"
          >
            <X size={14} aria-hidden="true" />
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-on-primary-fixed-variant disabled:opacity-60"
          >
            {isSaving && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {form.id ? "Save project" : "Add project"}
          </button>
        </div>
      </form>
    )

  return (
    <div className="flex flex-col gap-3">
      {list.length === 0 && !form && (
        <p className="text-[13px] text-on-surface-variant">
          No projects yet. Add the ones you want to present, with a link to open during the call.
        </p>
      )}

      {list.length > 0 && (
        <SortableList
          items={list}
          getId={(item) => item.id}
          getLabel={(item) => item.project}
          onReorder={(ids) => {
            const next = ids.map((id) => list.find((item) => item.id === id)).filter((item): item is Project => Boolean(item))
            void persist(next, true)
          }}
          disabled={disabled || isSaving || form !== null}
          label="Projects to show, in order"
          className="flex flex-col gap-2"
          renderItem={(item, handle) => {
            const index = list.findIndex((entry) => entry.id === item.id)
            if (form?.id === item.id) return renderForm()
            const hasLink = Boolean(item.link) && isSafeHref(item.link)
            return (
              <div className="flex items-start gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
                {handle}
                <span className="mt-1 text-[13px] font-semibold text-outline tabular-nums">{index + 1}.</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {hasLink ? (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[14px] font-semibold text-primary underline-offset-2 hover:underline"
                      >
                        {item.project}
                        <ExternalLink size={13} aria-hidden="true" />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    ) : (
                      <span className="text-[14px] font-semibold text-on-surface">{item.project}</span>
                    )}
                    {item.added_by_user && (
                      <span className="rounded-full bg-primary-fixed px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-on-primary-fixed-variant">
                        Added by you
                      </span>
                    )}
                  </div>
                  {hasLink && <p className="mt-0.5 truncate text-[12px] text-outline">{item.link}</p>}
                  {item.why_it_will_land && (
                    <p className="mt-1 text-[13px] leading-relaxed text-on-surface-variant">{item.why_it_will_land}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      setForm({ id: item.id, project: item.project, link: item.link, note: item.why_it_will_land })
                    }}
                    disabled={disabled || isSaving}
                    aria-label={`Edit ${item.project}`}
                    title="Edit"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-primary disabled:opacity-40"
                  >
                    <Pencil size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void persist(list.filter((entry) => entry.id !== item.id), true)}
                    disabled={disabled || isSaving}
                    aria-label={`Remove ${item.project}`}
                    title="Remove"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-outline hover:bg-error/10 hover:text-error disabled:opacity-40"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )
          }}
        />
      )}

      {form && form.id === null && renderForm()}

      {error && (
        <p role="alert" className="text-[12px] text-error">
          {error}
        </p>
      )}

      {!form && (
        <button
          type="button"
          onClick={() => {
            setError(null)
            setForm({ id: null, project: "", link: "", note: "" })
          }}
          disabled={disabled || isSaving || !canAdd}
          title={canAdd ? "Add a project to present" : `Up to ${MAX_PROJECTS_TO_SHOW} projects`}
          className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-outline-variant px-3 py-2 text-[13px] font-semibold text-on-surface-variant transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={15} aria-hidden="true" />
          Add project
        </button>
      )}

      {list.length > 0 && (
        <p className="text-[11px] text-outline">
          Drag to change the order. Projects you add or edit stay when you prepare the meeting again.
        </p>
      )}
    </div>
  )
}
