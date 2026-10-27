"use client"

import React, { useState } from "react"
import { Plus, Trash2, X } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { addChips, draftOf, emptyDraft, entryProblem, fieldsOf, limitOf, type EntryDraft, type EntryFields, type ProfilePair } from "@/lib/profileSections"
import { FIELD_LIMITS, type ProfileField, type ProfileSection } from "@/constants/profileSections"

const labelClass = "text-[11px] font-bold uppercase tracking-wider text-outline"
const hintClass = "text-[12px] text-on-surface-variant"
const fieldClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[14px] text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-50"

interface FieldProps {
  field: ProfileField
  value: EntryDraft[string]
  onChange: (value: EntryDraft[string]) => void
  disabled: boolean
}

/** Chips typed with a comma or Enter after each, or pasted as a list. */
const ChipsInput: React.FC<FieldProps & { id: string }> = ({ id, field, value, onChange }) => {
  const [typed, setTyped] = useState("")
  const chips = Array.isArray(value) ? (value as string[]) : []
  const take = () => {
    if (!typed.trim()) return
    onChange(addChips(chips, typed, field))
    setTyped("")
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest p-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
      {chips.map((chip) => (
        <span key={chip} className="inline-flex items-center gap-1 rounded-full bg-primary-fixed px-2.5 py-1 text-[12px] font-semibold text-on-primary-fixed-variant">
          {chip}
          <button type="button" onClick={() => onChange(chips.filter((kept) => kept !== chip))} aria-label={`Remove ${chip}`} className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-full hover:text-error md:min-h-0 md:min-w-0">
            <X size={12} aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={typed}
        onChange={(event) => {
          const next = event.target.value
          // A comma ends a chip, so a list pasted or typed with commas becomes chips at once
          if (!next.includes(",")) return setTyped(next)
          onChange(addChips(chips, next, field))
          setTyped("")
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            take()
          }
          if (event.key === "Backspace" && !typed && chips.length > 0) onChange(chips.slice(0, -1))
        }}
        onBlur={take}
        placeholder={chips.length === 0 ? field.placeholder : ""}
        disabled={chips.length >= FIELD_LIMITS.chips}
        className="h-8 min-w-[10rem] flex-1 bg-transparent px-1 text-[14px] text-on-surface placeholder:text-outline focus:outline-none"
      />
    </div>
  )
}

/** "If the client needs X → emphasize Y" lines, added and removed one at a time. */
const PairsInput: React.FC<FieldProps> = ({ field, value, onChange }) => {
  const pairs = Array.isArray(value) ? (value as ProfilePair[]) : []
  const [first, second] = field.pairLabels ?? ["", ""]
  const set = (index: number, patch: Partial<ProfilePair>) => onChange(pairs.map((pair, at) => (at === index ? { ...pair, ...patch } : pair)))
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {pairs.map((pair, index) => (
          <li key={index} className="flex flex-col gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 md:flex-row md:items-end">
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[12px] font-semibold text-on-surface">{first}</span>
              <input value={pair.first} maxLength={limitOf(field)} onChange={(event) => set(index, { first: event.target.value })} className={`${fieldClass} h-10`} />
            </label>
            <label className="flex min-w-0 flex-[2] flex-col gap-1">
              <span className="text-[12px] font-semibold text-on-surface">{second}</span>
              <input value={pair.second} maxLength={limitOf(field)} onChange={(event) => set(index, { second: event.target.value })} className={`${fieldClass} h-10`} />
            </label>
            <button
              type="button"
              onClick={() => onChange(pairs.filter((_, at) => at !== index))}
              aria-label={`Remove line ${index + 1}`}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-xl text-outline hover:bg-error-container hover:text-error"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onChange([...pairs, { first: "", second: "" }])}
        disabled={pairs.length >= FIELD_LIMITS.pairs}
        className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-dashed border-primary/50 px-3 py-2 text-[13px] font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
      >
        <Plus size={15} aria-hidden="true" />
        Add a line
      </button>
    </div>
  )
}

/** One field of the form, drawn for what it is. */
const FieldInput: React.FC<FieldProps & { id: string }> = (props) => {
  const { id, field, value, onChange, disabled } = props
  const text = typeof value === "string" ? value : ""
  switch (field.kind) {
    case "longText":
      return <textarea id={id} value={text} maxLength={limitOf(field)} rows={4} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} className={`${fieldClass} py-2.5`} />
    case "lines":
      return <textarea id={id} value={text} rows={4} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} className={`${fieldClass} py-2.5`} />
    case "month":
      return <input id={id} type="month" value={text} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={`${fieldClass} h-11`} />
    case "number":
      return <input id={id} type="number" inputMode="numeric" min={field.min} max={field.upTo} value={text} onChange={(event) => onChange(event.target.value)} className={`${fieldClass} h-11`} />
    case "choice":
      return (
        <select id={id} value={text} onChange={(event) => onChange(event.target.value)} className={`${fieldClass} h-11`}>
          <option value="">Not set</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )
    case "chips":
      return <ChipsInput {...props} />
    case "pairs":
      return <PairsInput {...props} />
    default:
      return (
        <input
          id={id}
          // A web address is plain text, so one typed without https:// is accepted and the server adds it
          type="text"
          inputMode={field.kind === "url" ? "url" : undefined}
          value={text}
          maxLength={limitOf(field)}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          className={`${fieldClass} h-11`}
        />
      )
  }
}

interface EntryFormDialogProps {
  section: ProfileSection
  // The entry's fields when one is being edited; null when one is being added
  editing: EntryFields | null
  isSaving: boolean
  error: string | null
  onSave: (fields: EntryFields) => void
  onClose: () => void
}

/**
 * Adding or editing one entry of a My AI Profile section. The form is built from the section's own
 * fields (constants/profileSections.ts): a line, a paragraph, a list typed one per line, chips, pairs,
 * a month, a number, a choice or a toggle, two short ones to a row on a wide screen.
 */
export const EntryFormDialog: React.FC<EntryFormDialogProps> = ({ section, editing, isSaving, error, onSave, onClose }) => {
  const [draft, setDraft] = useState<EntryDraft>(() => (editing ? draftOf(section, editing) : emptyDraft(section)))
  const [problem, setProblem] = useState<string | null>(null)
  const formId = `entry-form-${section.id}`
  // A field greyed out while the toggle that clears it is on (an end date while "I work here now")
  const clearedBy = new Map(section.fields.filter((field) => field.kind === "toggle" && field.clears).map((field) => [field.clears as string, field.key]))

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    const fields = fieldsOf(section, draft)
    const missing = entryProblem(section, fields)
    setProblem(missing)
    if (!missing) onSave(fields)
  }

  return (
    <Modal
      title={`${editing ? "Edit" : "Add"} ${section.noun}`}
      description={section.hint}
      onClose={onClose}
      isCloseDisabled={isSaving}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {(problem ?? error) && (
            <p role="alert" className="mr-auto text-[13px] text-error">
              {problem ?? error}
            </p>
          )}
          <button type="button" onClick={onClose} disabled={isSaving} className="whitespace-nowrap rounded-xl border border-outline-variant px-4 py-2 text-[14px] font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form={formId} disabled={isSaving} className="whitespace-nowrap rounded-xl bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-hover disabled:opacity-60">
            {isSaving ? "Saving..." : `Save ${section.noun}`}
          </button>
        </div>
      }
    >
      <form id={formId} onSubmit={save} className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {section.fields.map((field) => {
          const id = `${formId}-${field.key}`
          const toggle = clearedBy.get(field.key)
          const disabled = toggle ? draft[toggle] === true : false
          if (field.kind === "toggle") {
            return (
              <label key={field.key} className="flex items-center gap-2 text-[14px] font-semibold text-on-surface lg:col-span-2">
                <input type="checkbox" checked={draft[field.key] === true} onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.checked }))} className="h-4 w-4 accent-primary" />
                {field.label}
              </label>
            )
          }
          const isGroup = field.kind === "pairs"
          const Label = isGroup ? "p" : "label"
          return (
            <div key={field.key} className={`flex min-w-0 flex-col gap-1 ${field.half ? "" : "lg:col-span-2"}`}>
              <Label {...(isGroup ? {} : { htmlFor: id })} className={labelClass}>
                {field.label}
                {field.required && <span className="text-error"> *</span>}
              </Label>
              <FieldInput id={id} field={field} value={draft[field.key]} disabled={disabled} onChange={(value) => setDraft((current) => ({ ...current, [field.key]: value }))} />
              {field.hint && <p className={hintClass}>{field.hint}</p>}
            </div>
          )
        })}
      </form>
    </Modal>
  )
}
