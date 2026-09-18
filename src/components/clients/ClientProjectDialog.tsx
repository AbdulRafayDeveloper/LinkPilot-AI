"use client"

import React, { useRef, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { requestApi } from "@/lib/apiClient"
import {
  CLIENTS_ENDPOINT,
  CLIENT_PROJECT_DESCRIPTION_MAX_LENGTH,
  CLIENT_PROJECT_MESSAGES,
  CLIENT_PROJECT_NAME_MAX_LENGTH,
  CLIENT_PROJECT_STATUSES,
  DEFAULT_CLIENT_PROJECT_STATUS,
  type ClientProjectStatus,
} from "@/constants/clients"
import type { ClientProject, ClientProjectInput } from "@/types/clients"

const fieldClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[14px] text-on-surface placeholder:text-outline focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60"
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
 */
export const ClientProjectDialog: React.FC<ClientProjectDialogProps> = ({ clientId, clientName, project, onClose, onSaved }) => {
  const [form, setForm] = useState<ClientProjectInput>(
    project
      ? { name: project.name, description: project.description, status: project.status }
      : { name: "", description: "", status: DEFAULT_CLIENT_PROJECT_STATUS }
  )
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const update = <K extends keyof ClientProjectInput>(key: K, value: ClientProjectInput[K]) =>
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
      size="compact"
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
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-60"
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

        <fieldset className="flex flex-col gap-1.5">
          <legend className={`${labelClass} mb-1.5`}>Status</legend>
          <div className="grid grid-cols-2 gap-2">
            {CLIENT_PROJECT_STATUSES.map((status) => {
              const isChosen = form.status === status.id
              return (
                <label
                  key={status.id}
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                    isChosen
                      ? status.id === "completed"
                        ? "border-success bg-success-container text-on-success-container"
                        : "border-primary bg-primary-fixed text-on-primary-fixed-variant"
                      : "border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
                  }`}
                >
                  <input
                    type="radio"
                    name="client-project-status"
                    value={status.id}
                    checked={isChosen}
                    onChange={() => update("status", status.id as ClientProjectStatus)}
                    disabled={isSaving}
                    className="sr-only"
                  />
                  {status.label}
                </label>
              )
            })}
          </div>
        </fieldset>

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
