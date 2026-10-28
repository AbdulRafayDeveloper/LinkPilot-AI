"use client"

import React, { useId, useRef, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { requestApi } from "@/lib/apiClient"
import {
  CLIENTS_ENDPOINT,
  CLIENT_PROJECT_DESCRIPTION_MAX_LENGTH,
  CLIENT_PROJECT_INSTRUCTIONS_MAX_LENGTH,
  CLIENT_PROJECT_MESSAGES,
  CLIENT_PROJECT_NAME_MAX_LENGTH,
  DEFAULT_CLIENT_PROJECT_STATUS,
  clientProjectStatus,
} from "@/constants/clients"
import { ProjectStatusBadge } from "@/components/clients/ProjectStatusBadge"
import { ProjectStatusSelect } from "@/components/clients/ProjectStatusSelect"
import type { ClientProject, ClientProjectInput } from "@/types/clients"

const fieldClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[14px] text-on-surface placeholder:text-outline focus:border-primary focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60"
const labelClass = "text-[13px] font-semibold text-on-surface"

interface ClientProjectDialogProps {
  // The client the project belongs to
  clientId: string
  clientName: string
  // The project being edited, or null to add a new one
  project: ClientProject | null
  onClose: () => void
  onSaved: (project: ClientProject) => void
}

/**
 * Add and Edit share one dialog, the same way the client's own does. A project needs a name; what
 * the work is can be written now or left for later.
 *
 * The last field is the project's **prompt instructions**, which Prompt Creator adds to the end of
 * every prompt written for this project. It lives here because this is where a project is made:
 * there used to be a second Projects module with its own list and its own instructions box, and the
 * owner asked for one place. Leaving it empty leaves every prompt exactly as it is written.
 */
export const ClientProjectDialog: React.FC<ClientProjectDialogProps> = ({ clientId, clientName, project, onClose, onSaved }) => {
  const [form, setForm] = useState<Required<ClientProjectInput>>(
    project
      ? {
          name: project.name,
          description: project.description,
          status: project.status,
          promptInstructions: project.promptInstructions ?? "",
        }
      : { name: "", description: "", status: DEFAULT_CLIENT_PROJECT_STATUS, promptInstructions: "" }
  )
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const statusLabelId = useId()

  const update = <K extends keyof Required<ClientProjectInput>>(key: K, value: Required<ClientProjectInput>[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      const base = `${CLIENTS_ENDPOINT}/${clientId}/projects`
      const { data } = await requestApi<ClientProject>(
        project ? `${base}/${project.id}` : base,
        { method: project ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) },
        // Only the create needs a key: a repeated PUT replaces the same project with the same details
        project ? undefined : { idempotent: true }
      )
      onSaved(data)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : CLIENT_PROJECT_MESSAGES.saveFailed)
      setIsSaving(false)
    }
  }

  return (
    <Modal
      title={project ? `Edit ${project.name}` : "Add a project"}
      description={project ? `A project for ${clientName}.` : `A new piece of work for ${clientName}.`}
      onClose={onClose}
      isCloseDisabled={isSaving}
      initialFocusRef={nameRef}
      size="default"
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
            form="client-project-form"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
          >
            {isSaving && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
            {project ? "Save changes" : "Add project"}
          </button>
        </div>
      }
    >
      <form id="client-project-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Project name</span>
          <input
            ref={nameRef}
            value={form.name}
            maxLength={CLIENT_PROJECT_NAME_MAX_LENGTH}
            onChange={(event) => update("name", event.target.value)}
            className={`${fieldClass} h-10`}
            placeholder="e.g. Booking site rebuild"
            disabled={isSaving}
            required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className={labelClass}>What the work is</span>
            <span className="text-[11px] text-outline">
              {form.description.length.toLocaleString()} / {CLIENT_PROJECT_DESCRIPTION_MAX_LENGTH.toLocaleString()}
            </span>
          </div>
          <textarea
            value={form.description}
            maxLength={CLIENT_PROJECT_DESCRIPTION_MAX_LENGTH}
            onChange={(event) => update("description", event.target.value)}
            className={`${fieldClass} min-h-[120px] py-3 leading-relaxed`}
            placeholder="What you are building for them, in your own words. You can leave this and fill it in later."
            disabled={isSaving}
          />
        </label>

        {/* A dropdown rather than a button per status: seven of them would not fit a row on a phone, and
            the line under it says what the chosen one means. It is the app's own dropdown, never a
            native select, whose open list the browser draws and which was unreadable in the dark scheme */}
        <div className="flex flex-col gap-1.5">
          <span id={statusLabelId} className={labelClass}>{CLIENT_PROJECT_MESSAGES.statusLabel}</span>
          <ProjectStatusSelect value={form.status} onChange={(status) => update("status", status)} disabled={isSaving} labelId={statusLabelId} />
          <span className="flex items-center gap-2 text-[12px] text-on-surface-variant">
            <ProjectStatusBadge status={form.status} />
            {clientProjectStatus(form.status).description}
          </span>
        </div>

        <label className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={labelClass}>{CLIENT_PROJECT_MESSAGES.instructionsLabel}</span>
            <span className="text-[11px] text-outline">
              {form.promptInstructions.length.toLocaleString()} / {CLIENT_PROJECT_INSTRUCTIONS_MAX_LENGTH.toLocaleString()}
            </span>
          </div>
          <textarea
            value={form.promptInstructions}
            maxLength={CLIENT_PROJECT_INSTRUCTIONS_MAX_LENGTH}
            onChange={(event) => update("promptInstructions", event.target.value)}
            className={`${fieldClass} min-h-[96px] py-3 leading-relaxed`}
            placeholder={CLIENT_PROJECT_MESSAGES.instructionsPlaceholder}
            disabled={isSaving}
          />
          <span className="text-[12px] leading-relaxed text-on-surface-variant">{CLIENT_PROJECT_MESSAGES.instructionsHint}</span>
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
