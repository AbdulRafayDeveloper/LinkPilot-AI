"use client"

import React, { useEffect, useId, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, CornerDownLeft, Loader2, Plus, Trash2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { CopyButton } from "@/components/ui/CopyButton"
import { PromptAccessGate } from "@/components/prompts/PromptAccessGate"
import { PromptTabStrip } from "@/components/prompts/PromptTabStrip"
import { PromptLoadFailed, PromptLoading, type PromptFeedback } from "@/components/prompts/PromptModalParts"
import { requestApi } from "@/lib/apiClient"
import { useCloseAfterSave } from "@/hooks/useCloseAfterSave"
import {
  CLIENT_COUNTRY_MAX_LENGTH,
  CLIENT_MESSAGING_ENDPOINT,
  CLIENT_MESSAGING_MESSAGES,
  CLIENT_NAME_MAX_LENGTH,
  MESSAGE_FORMAT_MAX_LENGTH,
  SAMPLE_MESSAGE_COUNT,
  SAMPLE_MESSAGE_MAX_LENGTH,
} from "@/constants/clientMessaging"
import type { Client } from "@/types/clientMessaging"

const ENDPOINT = `${CLIENT_MESSAGING_ENDPOINT}/clients`
const NEW_PREFIX = "new-"
const SAMPLE_PREFIX = "sample-"

// The long fields of a client, in the order they are edited
const TEXT_FIELDS = [
  {
    key: "messageFormat",
    label: "Message format",
    placeholder:
      "How their messages are laid out. Example: short greeting, what moved this week, what is next, one question, a closing line.",
    maxLength: MESSAGE_FORMAT_MAX_LENGTH,
  },
  ...Array.from({ length: SAMPLE_MESSAGE_COUNT }, (_, index) => ({
    key: `${SAMPLE_PREFIX}${index}`,
    label: `Sample message ${index + 1}`,
    placeholder: "Paste a message you already sent this client, exactly as you sent it.",
    maxLength: SAMPLE_MESSAGE_MAX_LENGTH,
  })),
]

// One tab: a saved client, or a new one that exists only in this window until it is saved
interface Entry {
  id: string
  saved: Client | null
  name: string
  country: string
  messageFormat: string
  sampleMessages: string[]
}

const emptySamples = () => Array.from({ length: SAMPLE_MESSAGE_COUNT }, () => "")

const toEntry = (client: Client): Entry => ({
  id: client.id,
  saved: client,
  name: client.name,
  country: client.country,
  messageFormat: client.messageFormat,
  sampleMessages: [...client.sampleMessages],
})

const labelClass = "text-[10px] font-bold text-outline uppercase tracking-wider"
const fieldClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[13px] text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-60"
const buttonBase =
  "inline-flex items-center justify-center gap-2 px-4 py-2 border rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
const secondaryButton = `${buttonBase} border-outline-variant text-on-surface hover:bg-surface-container-high`

interface ClientsModalProps {
  // Selects this client on the page after the popup closes
  onUse: (client: Client) => void
  // Keeps the page's client list in step with what was saved
  onChanged: (clients: Client[]) => void
  onClose: () => void
}

/**
 * Manages the clients this module writes to: one tab per client, with their country, the
 * format their messages follow and their sample messages, plus adding and removing. Behind
 * the prompt password, like Update Prompt and Dummy Data.
 */
export const ClientsModal: React.FC<ClientsModalProps> = (props) => (
  <PromptAccessGate onClose={props.onClose}>
    <ClientsEditor {...props} />
  </PromptAccessGate>
)

const ClientsEditor: React.FC<ClientsModalProps> = ({ onUse, onChanged, onClose }) => {
  const idPrefix = useId()
  const nameInputRef = useRef<HTMLInputElement>(null)
  const newCountRef = useRef(0)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [feedback, setFeedback] = useState<PromptFeedback | null>(null)
  const { isClosing, closeAfterSave } = useCloseAfterSave(onClose)
  const isLocked = isBusy || isClosing

  const panelId = `${idPrefix}-panel`
  const tabId = (id: string) => `${idPrefix}-tab-${id}`
  const fieldId = (key: string) => `${idPrefix}-field-${key}`

  useEffect(() => {
    const controller = new AbortController()
    requestApi<Client[]>(ENDPOINT, { signal: controller.signal })
      .then(({ data }) => {
        setEntries(data.map(toEntry))
        setActiveId(data[0]?.id ?? null)
        setFeedback(null)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setFeedback({ type: "error", message: error instanceof Error ? error.message : CLIENT_MESSAGING_MESSAGES.loadFailed })
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [loadAttempt])

  const active = entries?.find((entry) => entry.id === activeId) ?? null
  const valueOf = (entry: Entry, key: string) =>
    key === "messageFormat" ? entry.messageFormat : entry.sampleMessages[Number(key.slice(SAMPLE_PREFIX.length))] ?? ""

  const isEntryDirty = (entry: Entry) =>
    entry.saved === null ||
    entry.name !== entry.saved.name ||
    entry.country !== entry.saved.country ||
    entry.messageFormat !== entry.saved.messageFormat ||
    entry.sampleMessages.some((sample, index) => sample !== (entry.saved?.sampleMessages[index] ?? ""))
  const isComplete = (entry: Entry) =>
    Boolean(entry.name.trim() && entry.country.trim() && entry.messageFormat.trim()) &&
    entry.sampleMessages.every((sample) => sample.trim())
  const hasUnsavedChanges = entries?.some(isEntryDirty) ?? false

  const selectEntry = (id: string) => {
    setActiveId(id)
    setIsConfirmingDelete(false)
    setFeedback(null)
  }

  const editActive = (patch: Partial<Omit<Entry, "id" | "saved">>) => {
    setEntries((current) => current?.map((entry) => (entry.id === activeId ? { ...entry, ...patch } : entry)) ?? current)
    if (feedback?.type === "success") setFeedback(null)
  }

  const editField = (key: string, value: string) => {
    if (key === "messageFormat") {
      editActive({ messageFormat: value })
      return
    }
    const index = Number(key.slice(SAMPLE_PREFIX.length))
    editActive({ sampleMessages: (active?.sampleMessages ?? emptySamples()).map((sample, at) => (at === index ? value : sample)) })
  }

  const addEntry = () => {
    newCountRef.current += 1
    const id = `${NEW_PREFIX}${newCountRef.current}`
    setEntries((current) => [
      ...(current ?? []),
      { id, saved: null, name: "", country: "", messageFormat: "", sampleMessages: emptySamples() },
    ])
    selectEntry(id)
    requestAnimationFrame(() => nameInputRef.current?.focus())
  }

  const publish = (next: Entry[]) => onChanged(next.map((entry) => entry.saved).filter((client): client is Client => client !== null))

  const removeActive = () => {
    const remaining = entries?.filter((entry) => entry.id !== activeId) ?? []
    setEntries(remaining)
    setActiveId(remaining[0]?.id ?? null)
    setIsConfirmingDelete(false)
    publish(remaining)
  }

  const handleSave = async () => {
    if (!active) return
    setIsBusy(true)
    setFeedback(null)
    try {
      const body = JSON.stringify({
        name: active.name,
        country: active.country,
        messageFormat: active.messageFormat,
        sampleMessages: active.sampleMessages,
      })
      const headers = { "Content-Type": "application/json" }
      const { data, message } = active.saved
        ? await requestApi<Client>(`${ENDPOINT}/${active.id}`, { method: "PUT", headers, body })
        : await requestApi<Client>(ENDPOINT, { method: "POST", headers, body })
      const next = entries?.map((entry) => (entry.id === active.id ? toEntry(data) : entry)) ?? [toEntry(data)]
      setEntries(next)
      setActiveId(data.id)
      publish(next)
      setFeedback({ type: "success", message: message || "Client saved." })
      closeAfterSave()
    } catch (error: unknown) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : CLIENT_MESSAGING_MESSAGES.saveFailed })
    } finally {
      setIsBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!active) return
    if (!active.saved) {
      removeActive()
      return
    }
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true)
      return
    }
    setIsBusy(true)
    setFeedback(null)
    try {
      const { message } = await requestApi<null>(`${ENDPOINT}/${active.id}`, { method: "DELETE" })
      removeActive()
      setFeedback({ type: "success", message: message || "Client removed." })
    } catch (error: unknown) {
      setIsConfirmingDelete(false)
      setFeedback({ type: "error", message: error instanceof Error ? error.message : CLIENT_MESSAGING_MESSAGES.deleteFailed })
    } finally {
      setIsBusy(false)
    }
  }

  // Only a saved client can be written to, since the message is built from what is stored
  const useActive = () => {
    if (!active?.saved) return
    onUse(active.saved)
    onClose()
  }

  const canSave = active !== null && isEntryDirty(active) && isComplete(active) && !isLocked

  const footer = (
    <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
      <div className="min-h-[20px] text-xs" aria-live="polite">
        {feedback && (
          <p
            role={feedback.type === "error" ? "alert" : "status"}
            className={`flex items-start gap-1.5 ${feedback.type === "error" ? "text-error" : "text-primary"}`}
          >
            {feedback.type === "error" ? (
              <AlertTriangle size={14} className="shrink-0 mt-px" aria-hidden="true" />
            ) : (
              <CheckCircle2 size={14} className="shrink-0 mt-px" aria-hidden="true" />
            )}
            <span>{feedback.message}</span>
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
        <button type="button" onClick={onClose} disabled={isBusy} className={secondaryButton}>
          {hasUnsavedChanges ? "Cancel" : "Close"}
        </button>
        {active && (
          <>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isLocked}
              className={`${buttonBase} ${
                isConfirmingDelete ? "border-error bg-error text-white hover:bg-error/90" : "border-error/40 text-error hover:bg-error/5"
              }`}
            >
              <Trash2 size={16} aria-hidden="true" />
              {isConfirmingDelete ? "Confirm delete" : "Delete"}
            </button>
            <button type="button" onClick={useActive} disabled={isLocked || !active.saved} className={secondaryButton}>
              <CornerDownLeft size={16} aria-hidden="true" />
              Write to this client
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-on-primary-fixed-variant text-white rounded-xl text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBusy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {isBusy ? "Saving..." : "Save Client"}
            </button>
          </>
        )}
      </div>
    </div>
  )

  return (
    <Modal
      title="Clients"
      description="Each client keeps their own message format and sample messages. Every message written for them follows that format, and never uses their name."
      onClose={onClose}
      isCloseDisabled={isBusy}
      size="large"
      footer={footer}
    >
      {isLoading ? (
        <PromptLoading text="Loading your clients..." />
      ) : !entries ? (
        <PromptLoadFailed
          onRetry={() => {
            setIsLoading(true)
            setLoadAttempt((attempt) => attempt + 1)
          }}
        />
      ) : (
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          <div className="flex items-start gap-2 shrink-0">
            {entries.length > 0 && (
              <div className="flex-1 min-w-0">
                <PromptTabStrip
                  tabs={entries.map((entry) => ({ id: entry.id, label: entry.name.trim() || "New client" }))}
                  activeId={activeId ?? entries[0].id}
                  onSelect={selectEntry}
                  isDirty={(id) => entries.some((entry) => entry.id === id && isEntryDirty(entry))}
                  ariaLabel="Clients"
                  tabId={tabId}
                  panelId={panelId}
                  disabled={isLocked}
                />
              </div>
            )}
            <button type="button" onClick={addEntry} disabled={isLocked} className={`${secondaryButton} shrink-0`}>
              <Plus size={16} aria-hidden="true" />
              Add client
            </button>
          </div>

          {active ? (
            <div role="tabpanel" id={panelId} aria-labelledby={tabId(active.id)} className="flex flex-col gap-3 flex-1 min-h-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={fieldId("name")} className={labelClass}>
                    Client name
                  </label>
                  <input
                    ref={nameInputRef}
                    id={fieldId("name")}
                    value={active.name}
                    onChange={(event) => editActive({ name: event.target.value })}
                    maxLength={CLIENT_NAME_MAX_LENGTH}
                    placeholder="e.g. Sara Malik, Clinicly"
                    disabled={isLocked}
                    className={`${fieldClass} py-2.5`}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={fieldId("country")} className={labelClass}>
                    Country
                  </label>
                  <input
                    id={fieldId("country")}
                    value={active.country}
                    onChange={(event) => editActive({ country: event.target.value })}
                    maxLength={CLIENT_COUNTRY_MAX_LENGTH}
                    placeholder="e.g. United Kingdom"
                    disabled={isLocked}
                    className={`${fieldClass} py-2.5`}
                  />
                </div>
              </div>

              {TEXT_FIELDS.map((field) => {
                const value = valueOf(active, field.key)
                return (
                  <div key={field.key} className="flex flex-col gap-1.5 flex-1 min-h-0">
                    <div className="flex items-center justify-between gap-2 min-h-[24px]">
                      <label htmlFor={fieldId(field.key)} className={labelClass}>
                        {field.label}
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-outline">
                          {value.length.toLocaleString()} / {field.maxLength.toLocaleString()}
                        </span>
                        {value.trim() && <CopyButton text={value} label={`Copy ${field.label.toLowerCase()}`} showLabel />}
                      </div>
                    </div>
                    <textarea
                      id={fieldId(field.key)}
                      value={value}
                      onChange={(event) => editField(field.key, event.target.value)}
                      maxLength={field.maxLength}
                      placeholder={field.placeholder}
                      disabled={isLocked}
                      className={`${fieldClass} py-3 flex-1 min-h-[120px]`}
                    />
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="flex-1 flex items-center justify-center text-sm text-on-surface-variant text-center px-4">
              {CLIENT_MESSAGING_MESSAGES.noClients}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
