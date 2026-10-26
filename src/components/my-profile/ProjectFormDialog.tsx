"use client"

import React, { useState } from "react"
import { Plus, Trash2, X } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { addKeywords, draftOf, draftProblem, emptyDraft, projectOf } from "@/lib/profileProjects"
import { PROFILE_PROJECT_MESSAGES, PROJECT_FIELDS, PROJECT_LIMITS } from "@/constants/profileProjects"
import type { ProfileProject, ProjectDraft } from "@/types/profileProjects"

const labelClass = "text-[11px] font-bold uppercase tracking-wider text-outline"
const hintClass = "text-[12px] text-on-surface-variant"
const fieldClass =
  "w-full rounded-xl border border-outline-variant bg-white px-3 text-[14px] text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"

const Field: React.FC<{ id: string; label: string; hint: string; required?: boolean; children: React.ReactNode }> = ({ id, label, hint, required, children }) => (
  <div className="flex flex-col gap-1">
    <label htmlFor={id} className={labelClass}>
      {label}
      {required && <span className="text-error"> *</span>}
    </label>
    {children}
    <p className={hintClass}>{hint}</p>
  </div>
)

interface ProjectFormDialogProps {
  // The project being edited, or null when one is being added
  editing: ProfileProject | null
  onSave: (project: ProfileProject) => void
  onClose: () => void
}

/**
 * Adding or editing one project on My AI Profile → Projects. Each field is one part of how a
 * project is written up: the name, the summary, what stands out, the Upwork jobs it proves, what to
 * stress for a given client need, and the words it should be found by.
 */
export const ProjectFormDialog: React.FC<ProjectFormDialogProps> = ({ editing, onSave, onClose }) => {
  const [draft, setDraft] = useState<ProjectDraft>(() => (editing ? draftOf(editing) : emptyDraft()))
  const [keyword, setKeyword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<ProjectDraft>) => setDraft((current) => ({ ...current, ...patch }))
  const setMatch = (index: number, patch: Partial<ProjectDraft["proposalMatches"][number]>) =>
    setDraft((current) => ({ ...current, proposalMatches: current.proposalMatches.map((match, at) => (at === index ? { ...match, ...patch } : match)) }))

  const takeKeyword = () => {
    if (!keyword.trim()) return
    set({ keywords: addKeywords(draft.keywords, keyword) })
    setKeyword("")
  }

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    // A keyword still in the box counts, so it is not lost for want of an Enter
    const ready = keyword.trim() ? { ...draft, keywords: addKeywords(draft.keywords, keyword) } : draft
    const problem = draftProblem(ready)
    if (problem) {
      setError(problem)
      return
    }
    onSave(projectOf(ready, editing))
  }

  const f = PROJECT_FIELDS
  return (
    <Modal
      title={editing ? PROFILE_PROJECT_MESSAGES.edit : PROFILE_PROJECT_MESSAGES.add}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {error && (
            <p role="alert" className="mr-auto text-[13px] text-error">
              {error}
            </p>
          )}
          <button type="button" onClick={onClose} className="rounded-xl border border-outline-variant px-4 py-2 text-[14px] font-semibold text-on-surface hover:bg-surface-container-high">
            {PROFILE_PROJECT_MESSAGES.cancel}
          </button>
          <button type="submit" form="project-form" className="rounded-xl bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-on-primary-fixed-variant">
            {PROFILE_PROJECT_MESSAGES.save}
          </button>
        </div>
      }
    >
      <form id="project-form" onSubmit={save} className="flex flex-col gap-5">
        <Field id="project-name" label={f.name.label} hint={f.name.hint} required>
          <input
            id="project-name"
            value={draft.name}
            maxLength={PROJECT_LIMITS.name}
            onChange={(event) => set({ name: event.target.value })}
            placeholder={f.name.placeholder}
            className={`${fieldClass} h-11`}
          />
        </Field>

        <Field id="project-summary" label={f.summary.label} hint={f.summary.hint} required>
          <textarea
            id="project-summary"
            value={draft.summary}
            maxLength={PROJECT_LIMITS.summary}
            onChange={(event) => set({ summary: event.target.value })}
            placeholder={f.summary.placeholder}
            rows={4}
            className={`${fieldClass} py-2.5`}
          />
        </Field>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Field id="project-highlights" label={f.highlights.label} hint={f.highlights.hint}>
            <textarea
              id="project-highlights"
              value={draft.highlights}
              onChange={(event) => set({ highlights: event.target.value })}
              placeholder={f.highlights.placeholder}
              rows={5}
              className={`${fieldClass} py-2.5`}
            />
          </Field>
          <Field id="project-matches" label={f.bestMatches.label} hint={f.bestMatches.hint}>
            <textarea
              id="project-matches"
              value={draft.bestMatches}
              onChange={(event) => set({ bestMatches: event.target.value })}
              placeholder={f.bestMatches.placeholder}
              rows={5}
              className={`${fieldClass} py-2.5`}
            />
          </Field>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className={labelClass}>{f.proposalMatches.label}</legend>
          <p className={hintClass}>{f.proposalMatches.hint}</p>
          <ul className="flex flex-col gap-2">
            {draft.proposalMatches.map((match, index) => (
              <li key={index} className="flex flex-col gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 md:flex-row md:items-start">
                <label className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[12px] font-semibold text-on-surface">{f.proposalMatches.need}</span>
                  <input
                    value={match.need}
                    maxLength={PROJECT_LIMITS.match}
                    onChange={(event) => setMatch(index, { need: event.target.value })}
                    placeholder={f.proposalMatches.needPlaceholder}
                    className={`${fieldClass} h-10`}
                  />
                </label>
                <label className="flex min-w-0 flex-[2] flex-col gap-1">
                  <span className="text-[12px] font-semibold text-on-surface">{f.proposalMatches.emphasize}</span>
                  <input
                    value={match.emphasize}
                    maxLength={PROJECT_LIMITS.match}
                    onChange={(event) => setMatch(index, { emphasize: event.target.value })}
                    placeholder={f.proposalMatches.emphasizePlaceholder}
                    className={`${fieldClass} h-10`}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, proposalMatches: current.proposalMatches.filter((_, at) => at !== index) }))}
                  aria-label={`Remove match ${index + 1}`}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-xl text-outline hover:bg-error-container hover:text-error"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setDraft((current) => ({ ...current, proposalMatches: [...current.proposalMatches, { need: "", emphasize: "" }] }))}
            disabled={draft.proposalMatches.length >= PROJECT_LIMITS.matches}
            className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-dashed border-primary/50 px-3 py-2 text-[13px] font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
          >
            <Plus size={15} aria-hidden="true" />
            {PROFILE_PROJECT_MESSAGES.addMatch}
          </button>
        </fieldset>

        <Field id="project-keywords" label={f.keywords.label} hint={f.keywords.hint}>
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-outline-variant bg-white p-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
            {draft.keywords.map((word) => (
              <span key={word} className="inline-flex items-center gap-1 rounded-full bg-primary-fixed px-2.5 py-1 text-[12px] font-semibold text-primary">
                {word}
                <button type="button" onClick={() => set({ keywords: draft.keywords.filter((kept) => kept !== word) })} aria-label={`Remove ${word}`} className="rounded-full hover:text-error">
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
            ))}
            <input
              id="project-keywords"
              value={keyword}
              onChange={(event) => {
                const value = event.target.value
                // A comma ends a keyword, so a list pasted or typed with commas becomes chips at once
                if (!value.includes(",")) {
                  setKeyword(value)
                  return
                }
                set({ keywords: addKeywords(draft.keywords, value) })
                setKeyword("")
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  takeKeyword()
                }
                if (event.key === "Backspace" && !keyword && draft.keywords.length > 0) set({ keywords: draft.keywords.slice(0, -1) })
              }}
              onBlur={takeKeyword}
              placeholder={draft.keywords.length === 0 ? f.keywords.placeholder : ""}
              className="h-8 min-w-[10rem] flex-1 bg-transparent px-1 text-[14px] text-on-surface placeholder:text-outline focus:outline-none"
            />
          </div>
        </Field>
      </form>
    </Modal>
  )
}
