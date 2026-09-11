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
import { DUMMY_DATA_ENDPOINT, DUMMY_ITEM_NAME_MAX_LENGTH, dummyKindConfig, type DummyDataKind } from "@/constants/dummyData"
import type { DummyItem } from "@/types/dummyData"

const NEW_PREFIX = "new-"

// One tab: a saved item, or a new one that exists only in this window until it's saved
interface Entry {
  id: string
  saved: DummyItem | null
  name: string
  fields: Record<string, string>
}

const toEntry = (item: DummyItem): Entry => ({ id: item.id, saved: item, name: item.name, fields: { ...item.fields } })
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
const titleCase = (value: string) => value.split(" ").map(capitalize).join(" ")

const labelClass = "text-[10px] font-bold text-outline uppercase tracking-wider"
const fieldClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[13px] text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-60"
const buttonBase =
  "inline-flex items-center justify-center gap-2 px-4 py-2 border rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
const secondaryButton = `${buttonBase} border-outline-variant text-on-surface hover:bg-surface-container-high`

interface DummyDataModalProps {
  kind: DummyDataKind
  // Fills the tool's inputs with the chosen item's fields, keyed by field key
  onUse: (fields: Record<string, string>) => void
  onClose: () => void
}

/**
 * Manages one kind of Dummy Data (sample profiles, posts, comment threads, conversations)
 * kept as markdown files: one tab per item, edited like a prompt, plus adding, removing,
 * copying a field and loading an item into the tool. Behind the prompt password, like
 * Update Prompt.
 */
export const DummyDataModal: React.FC<DummyDataModalProps> = (props) => (
  <PromptAccessGate onClose={props.onClose}>
    <DummyDataEditor {...props} />
  </PromptAccessGate>
)

const DummyDataEditor: React.FC<DummyDataModalProps> = ({ kind, onUse, onClose }) => {
  const config = dummyKindConfig(kind)
  const endpoint = `${DUMMY_DATA_ENDPOINT}/${kind}`
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
  const nameId = `${idPrefix}-name`
  const fieldId = (key: string) => `${idPrefix}-field-${key}`
  const emptyFields = () => Object.fromEntries(config.fields.map((field) => [field.key, ""]))

  const isEntryDirty = (entry: Entry) =>
    entry.saved === null ||
    entry.name !== entry.saved.name ||
    config.fields.some((field) => (entry.fields[field.key] ?? "") !== (entry.saved?.fields[field.key] ?? ""))
  const hasRequiredFields = (entry: Entry) => config.fields.every((field) => !field.required || entry.fields[field.key]?.trim())

  useEffect(() => {
    const controller = new AbortController()
    requestApi<DummyItem[]>(endpoint, { signal: controller.signal })
      .then(({ data }) => {
        setEntries(data.map(toEntry))
        setActiveId(data[0]?.id ?? null)
        setFeedback(null)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setFeedback({ type: "error", message: error instanceof Error ? error.message : `Couldn't load the dummy ${config.item}s.` })
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [loadAttempt, endpoint, config.item])

  const active = entries?.find((entry) => entry.id === activeId) ?? null
  const hasUnsavedChanges = entries?.some(isEntryDirty) ?? false

  const selectEntry = (id: string) => {
    setActiveId(id)
    setIsConfirmingDelete(false)
    setFeedback(null)
  }

  const editActive = (patch: { name: string } | { field: string; value: string }) => {
    setEntries(
      (current) =>
        current?.map((entry) => {
          if (entry.id !== activeId) return entry
          return "name" in patch ? { ...entry, name: patch.name } : { ...entry, fields: { ...entry.fields, [patch.field]: patch.value } }
        }) ?? current
    )
    if (feedback?.type === "success") setFeedback(null)
  }

  const addEntry = () => {
    newCountRef.current += 1
    const id = `${NEW_PREFIX}${newCountRef.current}`
    setEntries((current) => [...(current ?? []), { id, saved: null, name: "", fields: emptyFields() }])
    selectEntry(id)
    requestAnimationFrame(() => nameInputRef.current?.focus())
  }

  const removeActive = () => {
    const remaining = entries?.filter((entry) => entry.id !== activeId) ?? []
    setEntries(remaining)
    setActiveId(remaining[0]?.id ?? null)
    setIsConfirmingDelete(false)
  }

  const handleSave = async () => {
    if (!active) return
    setIsBusy(true)
    setFeedback(null)
    try {
      const body = JSON.stringify({ name: active.name, fields: active.fields })
      const headers = { "Content-Type": "application/json" }
      const { data, message } = active.saved
        ? await requestApi<DummyItem>(`${endpoint}/${active.id}`, { method: "PUT", headers, body })
        : await requestApi<DummyItem>(endpoint, { method: "POST", headers, body })
      setEntries((current) => current?.map((entry) => (entry.id === active.id ? toEntry(data) : entry)) ?? current)
      setActiveId(data.id)
      setFeedback({ type: "success", message: message || `${capitalize(config.item)} saved.` })
      closeAfterSave()
    } catch (error: unknown) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : `Couldn't save the ${config.item}.` })
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
      const { message } = await requestApi<{ id: string }>(`${endpoint}/${active.id}`, { method: "DELETE" })
      removeActive()
      setFeedback({ type: "success", message: message || `${capitalize(config.item)} removed.` })
    } catch (error: unknown) {
      setIsConfirmingDelete(false)
      setFeedback({ type: "error", message: error instanceof Error ? error.message : `Couldn't remove the ${config.item}.` })
    } finally {
      setIsBusy(false)
    }
  }

  // Loads the fields as they are in the editor (unsaved edits included) and closes the popup
  const loadIntoTool = () => {
    if (!active || !hasRequiredFields(active)) return
    onUse(active.fields)
    onClose()
  }

  const canSave = active !== null && isEntryDirty(active) && active.name.trim() !== "" && hasRequiredFields(active) && !isLocked

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
            <button type="button" onClick={loadIntoTool} disabled={isLocked || !hasRequiredFields(active)} className={secondaryButton}>
              <CornerDownLeft size={16} aria-hidden="true" />
              Use this {config.item}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-on-primary-fixed-variant text-white rounded-xl text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBusy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {isBusy ? "Saving..." : `Save ${titleCase(config.item)}`}
            </button>
          </>
        )}
      </div>
    </div>
  )

  return (
    <Modal title="Dummy Data" description={config.description} onClose={onClose} isCloseDisabled={isBusy} size="large" footer={footer}>
      {isLoading ? (
        <PromptLoading text={`Loading the dummy ${config.item}s...`} />
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
                  tabs={entries.map((entry) => ({ id: entry.id, label: entry.name.trim() || `New ${config.item}` }))}
                  activeId={activeId ?? entries[0].id}
                  onSelect={selectEntry}
                  isDirty={(id) => entries.some((entry) => entry.id === id && isEntryDirty(entry))}
                  ariaLabel={`Dummy ${config.item}s`}
                  tabId={tabId}
                  panelId={panelId}
                  disabled={isLocked}
                />
              </div>
            )}
            <button type="button" onClick={addEntry} disabled={isLocked} className={`${secondaryButton} shrink-0`}>
              <Plus size={16} aria-hidden="true" />
              Add {config.item}
            </button>
          </div>

          {active ? (
            <div role="tabpanel" id={panelId} aria-labelledby={tabId(active.id)} className="flex flex-col gap-3 flex-1 min-h-0">
              <div className="flex flex-col gap-1.5 shrink-0">
                <label htmlFor={nameId} className={labelClass}>
                  {capitalize(config.item)} name
                </label>
                <input
                  ref={nameInputRef}
                  id={nameId}
                  value={active.name}
                  onChange={(event) => editActive({ name: event.target.value })}
                  maxLength={DUMMY_ITEM_NAME_MAX_LENGTH}
                  placeholder={config.namePlaceholder}
                  disabled={isLocked}
                  className={`${fieldClass} py-2.5`}
                />
              </div>

              {config.fields.map((field) => {
                const value = active.fields[field.key] ?? ""
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
                        {value.trim() && (
                          <CopyButton text={value} label={`Copy ${field.label.replace(/\s*\(optional\)$/i, "").toLowerCase()}`} showLabel />
                        )}
                      </div>
                    </div>
                    <textarea
                      id={fieldId(field.key)}
                      value={value}
                      onChange={(event) => editActive({ field: field.key, value: event.target.value })}
                      maxLength={field.maxLength}
                      placeholder={field.placeholder}
                      disabled={isLocked}
                      className={`${fieldClass} py-3 flex-1 ${
                        config.fields.length > 1 ? "min-h-[140px]" : "min-h-[240px]"
                      } resize-none overflow-y-auto leading-relaxed whitespace-pre-wrap`}
                    />
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <p className="text-sm font-semibold text-on-surface">No dummy {config.item}s yet</p>
              <p className="text-xs text-on-surface-variant">Add one to keep a sample ready for testing.</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
