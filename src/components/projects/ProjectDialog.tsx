"use client"

import React, { useRef, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { PROJECT_INSTRUCTIONS_MAX_LENGTH, PROJECT_NAME_MAX_LENGTH, PROMPT_PROJECT_MESSAGES } from "@/constants/promptProjects"
import type { PromptProject } from "@/types/promptProjects"

const fieldClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[14px] text-on-surface placeholder:text-outline focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60"
const labelClass = "text-[13px] font-semibold text-on-surface"

interface ProjectDialogProps {
  // The project being edited, or null to add a new one
  project: PromptProject | null
  // Saves through the page's shared list, so Prompt Creator's picker and this page never disagree
  onSave: (input: { name: string; instructions: string }) => Promise<PromptProject>
  onClose: () => void
  onSaved: (project: PromptProject) => void
}

/**
 * Add and Edit share one dialog, so editing starts from what was saved, the same way Clients
 * Management's does. The server checks every field again (a name taken by another project is
 * refused whatever its case), and its message is shown as is when it refuses one.
 */
export const ProjectDialog: React.FC<ProjectDialogProps> = ({ project, onSave, onClose, onSaved }) => {
  const [form, setForm] = useState({ name: project?.name ?? "", instructions: project?.instructions ?? "" })
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSaving) return
    if (!form.name.trim()) {
      setError(PROMPT_PROJECT_MESSAGES.missingName)
      nameRef.current?.focus()
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      onSaved(await onSave({ name: form.name, instructions: form.instructions }))
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : project ? PROMPT_PROJECT_MESSAGES.saveFailed : PROMPT_PROJECT_MESSAGES.createFailed)
      setIsSaving(false)
    }
  }

  return (
    <Modal
      title={project ? `Edit ${project.name}` : "Add a project"}
      description={
        project
          ? "Change its name or its instructions. The prompts already written in it stay exactly as they were written."
          : "What your prompts are written for, and the instructions every prompt written in it should end with."
      }
      onClose={onClose}
      isCloseDisabled={isSaving}
      initialFocusRef={nameRef}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="project-form"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-60"
          >
            {isSaving && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
            {project ? "Save changes" : "Add project"}
          </button>
        </div>
      }
    >
      <form id="project-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Project name</span>
          <input
            ref={nameRef}
            value={form.name}
            maxLength={PROJECT_NAME_MAX_LENGTH}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            className={`${fieldClass} h-10`}
            placeholder="e.g. Clinic booking app"
            disabled={isSaving}
            required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className={labelClass}>Instructions for every prompt in it (optional)</span>
            <span className="text-[11px] text-outline">
              {form.instructions.length.toLocaleString()} / {PROJECT_INSTRUCTIONS_MAX_LENGTH.toLocaleString()}
            </span>
          </div>
          <textarea
            value={form.instructions}
            maxLength={PROJECT_INSTRUCTIONS_MAX_LENGTH}
            onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))}
            className={`${fieldClass} min-h-[160px] py-3 leading-relaxed`}
            placeholder="We use Next.js 16 and Tailwind. Never add a new dependency without asking."
            disabled={isSaving}
          />
          <span className="text-[12px] text-outline">{PROMPT_PROJECT_MESSAGES.instructionsHint}</span>
        </label>

        {error && (
          <p role="alert" className="flex gap-2 rounded-xl bg-error-container px-3 py-2.5 text-[13px] text-error">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
