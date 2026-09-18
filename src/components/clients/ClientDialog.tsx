"use client"

import React, { useRef, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { requestApi } from "@/lib/apiClient"
import { CLIENTS_ENDPOINT, CLIENTS_MESSAGES } from "@/constants/clients"
import {
  CLIENT_COUNTRY_MAX_LENGTH,
  CLIENT_NAME_MAX_LENGTH,
  MESSAGE_FORMAT_MAX_LENGTH,
  SAMPLE_MESSAGE_COUNT,
  SAMPLE_MESSAGE_MAX_LENGTH,
} from "@/constants/clientMessaging"
import type { Client, ClientInput } from "@/types/clientMessaging"

const fieldClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[14px] text-on-surface placeholder:text-outline focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60"
const labelClass = "text-[13px] font-semibold text-on-surface"

const emptySamples = () => Array.from({ length: SAMPLE_MESSAGE_COUNT }, () => "")

// Always the agreed number of slots, so a client saved before a change still lines up
const samplesOf = (client: Client) => Array.from({ length: SAMPLE_MESSAGE_COUNT }, (_, index) => client.sampleMessages[index] ?? "")

interface ClientDialogProps {
  // The client being edited, or null to add a new one
  client: Client | null
  onClose: () => void
  onSaved: (client: Client) => void
}

/**
 * Add and Edit share one dialog, so editing starts from what was saved. The server checks every
 * field again; its message is shown as is when it refuses one.
 */
export const ClientDialog: React.FC<ClientDialogProps> = ({ client, onClose, onSaved }) => {
  const [form, setForm] = useState<ClientInput>(
    client
      ? { name: client.name, country: client.country, messageFormat: client.messageFormat, sampleMessages: samplesOf(client) }
      : { name: "", country: "", messageFormat: "", sampleMessages: emptySamples() }
  )
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const update = <K extends keyof ClientInput>(key: K, value: ClientInput[K]) => setForm((current) => ({ ...current, [key]: value }))
  const updateSample = (index: number, value: string) =>
    update(
      "sampleMessages",
      form.sampleMessages.map((sample, at) => (at === index ? value : sample))
    )

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      const { data } = await requestApi<Client>(
        client ? `${CLIENTS_ENDPOINT}/${client.id}` : CLIENTS_ENDPOINT,
        { method: client ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) },
        // Only the create needs a key: a repeated PUT replaces the same client with the same details
        client ? undefined : { idempotent: true }
      )
      onSaved(data)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : CLIENTS_MESSAGES.saveFailed)
      setIsSaving(false)
    }
  }

  return (
    <Modal
      title={client ? `Edit ${client.name}` : "Add a client"}
      description={
        client
          ? "Change their details. Their projects and the messages already written for them stay as they are."
          : "Who they are, the format their messages follow, and two messages you already sent them as examples."
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
            form="client-form"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-60"
          >
            {isSaving && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
            {client ? "Save changes" : "Add client"}
          </button>
        </div>
      }
    >
      <form id="client-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Client name</span>
            <input
              ref={nameRef}
              value={form.name}
              maxLength={CLIENT_NAME_MAX_LENGTH}
              onChange={(event) => update("name", event.target.value)}
              className={`${fieldClass} h-10`}
              placeholder="e.g. Sara Malik, Clinicly"
              disabled={isSaving}
              required
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Country</span>
            <input
              value={form.country}
              maxLength={CLIENT_COUNTRY_MAX_LENGTH}
              onChange={(event) => update("country", event.target.value)}
              className={`${fieldClass} h-10`}
              placeholder="e.g. United Kingdom"
              disabled={isSaving}
              required
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className={labelClass}>Message format</span>
            <span className="text-[11px] text-outline">
              {form.messageFormat.length.toLocaleString()} / {MESSAGE_FORMAT_MAX_LENGTH.toLocaleString()}
            </span>
          </div>
          <textarea
            value={form.messageFormat}
            maxLength={MESSAGE_FORMAT_MAX_LENGTH}
            onChange={(event) => update("messageFormat", event.target.value)}
            className={`${fieldClass} min-h-[110px] py-3 leading-relaxed`}
            placeholder="How their messages are laid out. Example: short greeting, what moved this week, what is next, one question, a closing line."
            disabled={isSaving}
            required
          />
        </label>

        {form.sampleMessages.map((sample, index) => (
          <label key={index} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className={labelClass}>Sample message {index + 1}</span>
              <span className="text-[11px] text-outline">
                {sample.length.toLocaleString()} / {SAMPLE_MESSAGE_MAX_LENGTH.toLocaleString()}
              </span>
            </div>
            <textarea
              value={sample}
              maxLength={SAMPLE_MESSAGE_MAX_LENGTH}
              onChange={(event) => updateSample(index, event.target.value)}
              className={`${fieldClass} min-h-[100px] py-3 leading-relaxed`}
              placeholder="Paste a message you already sent this client, exactly as you sent it."
              disabled={isSaving}
              required
            />
          </label>
        ))}

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
