"use client"

import React, { useRef, useState } from "react"
import { AlertTriangle, Loader2, Save } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { CREATED_NAME_MAX_LENGTH, CREATED_PROMPT_MAX_LENGTH, PROMPT_CREATOR_MESSAGES } from "@/constants/promptCreator"
import { requestApi } from "@/lib/apiClient"

interface EditPromptDialogProps {
  // The record route: PUT <endpoint>/<id> with the new name and the new text
  endpoint: string
  recordId: string
  // What is saved now, which is what the fields open on
  name: string
  text: string
  // The label of the text being edited ("Prompt"), so the field says what it holds
  textLabel: string
  onSaved: (saved: { name: string; text: string }) => void
  onClose: () => void
}

const fieldClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[14px] text-on-surface focus:border-primary focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/25"
const labelClass = "text-[13px] font-semibold text-on-surface"

/**
 * Rewrites a saved record from the page that lists it, so a prompt is corrected where it is read
 * rather than only on the page that wrote it.
 *
 * It asks for the two things that are the user's own words, the name it is found by and the text
 * itself, and **nothing else**: the folder, what it waits for and whether it has been applied each
 * have their own action on the row, and the record's own PUT writes only the fields it is sent. The
 * server marks the record as edited by hand, which is what the row's own tag then says.
 */
export const EditPromptDialog: React.FC<EditPromptDialogProps> = ({ endpoint, recordId, name, text, textLabel, onSaved, onClose }) => {
  const nameRef = useRef<HTMLInputElement>(null)
  const [draftName, setDraftName] = useState(name)
  const [draftText, setDraftText] = useState(text)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const isFilled = Boolean(draftName.trim() && draftText.trim())
  const isChanged = draftName.trim() !== name.trim() || draftText.trim() !== text.trim()

  const save = async () => {
    if (!isFilled) {
      setError(draftName.trim() ? PROMPT_CREATOR_MESSAGES.emptyPrompt : PROMPT_CREATOR_MESSAGES.missingName)
      return
    }
    const saved = { name: draftName.trim(), text: draftText.trim() }
    setIsSaving(true)
    setError(null)
    try {
      await requestApi<unknown>(`${endpoint}/${recordId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: saved.name, prompt: saved.text }),
      })
      onSaved(saved)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : PROMPT_CREATOR_MESSAGES.editFailed)
      setIsSaving(false)
    }
  }

  return (
    <Modal
      title={PROMPT_CREATOR_MESSAGES.editTitle}
      description={name}
      onClose={onClose}
      size="large"
      isCloseDisabled={isSaving}
      initialFocusRef={nameRef}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] text-outline">
            {draftText.length.toLocaleString()} / {CREATED_PROMPT_MAX_LENGTH.toLocaleString()} characters
            {!isChanged && ` · ${PROMPT_CREATOR_MESSAGES.editUnchanged}`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={isSaving || !isFilled || !isChanged}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
              {isSaving ? PROMPT_CREATOR_MESSAGES.addSaving : PROMPT_CREATOR_MESSAGES.editSave}
            </button>
          </div>
        </div>
      }
    >
      {/* One column at every width: the text fills what is left of the panel, and on a short screen
          the panel's own body scrolls rather than squeezing the box to nothing */}
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <p className="shrink-0 text-[12px] leading-relaxed text-on-surface-variant">{PROMPT_CREATOR_MESSAGES.editHint}</p>

        {error && (
          <p role="alert" className="flex shrink-0 items-start gap-2 rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        <label className="flex shrink-0 flex-col gap-1.5">
          <span className={labelClass}>{PROMPT_CREATOR_MESSAGES.addedName}</span>
          <input
            ref={nameRef}
            name="name"
            value={draftName}
            maxLength={CREATED_NAME_MAX_LENGTH}
            onChange={(event) => setDraftName(event.target.value)}
            disabled={isSaving}
            className={`${fieldClass} h-10 disabled:opacity-60`}
            required
          />
        </label>

        <label className="flex min-h-0 flex-1 flex-col gap-1.5">
          <span className={labelClass}>{textLabel}</span>
          <textarea
            name="prompt"
            value={draftText}
            maxLength={CREATED_PROMPT_MAX_LENGTH}
            onChange={(event) => setDraftText(event.target.value)}
            disabled={isSaving}
            className={`${fieldClass} custom-scrollbar min-h-[200px] flex-1 resize-none py-2.5 font-mono text-[13px] leading-relaxed disabled:opacity-60`}
            required
          />
        </label>
      </div>
    </Modal>
  )
}
