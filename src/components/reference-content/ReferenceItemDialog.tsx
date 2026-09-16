"use client"

import React, { useRef, useState } from "react"
import { Loader2, Save } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import {
  REFERENCE_CONTENT_MAX_LENGTH,
  REFERENCE_CONTENT_MESSAGES,
  REFERENCE_TITLE_MAX_LENGTH,
} from "@/constants/referenceContent"
import type { ReferenceItem, ReferenceItemInput } from "@/types/referenceContent"

interface ReferenceItemDialogProps {
  // The item being edited, or null when adding a new one
  item: ReferenceItem | null
  isSaving: boolean
  error: string | null
  onSave: (input: ReferenceItemInput) => void
  onClose: () => void
}

const labelClass = "text-[10px] font-bold uppercase tracking-wider text-outline"
const fieldClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[13px] text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"

/**
 * Adds a new piece of reference content, or edits one that exists. The same form does both, so
 * editing starts from what was saved. Saving is blocked until both fields have something in them.
 */
export const ReferenceItemDialog: React.FC<ReferenceItemDialogProps> = ({ item, isSaving, error, onSave, onClose }) => {
  const [title, setTitle] = useState(item?.title ?? "")
  const [content, setContent] = useState(item?.content ?? "")
  const [problem, setProblem] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLTextAreaElement>(null)

  const submit = () => {
    if (isSaving) return
    if (!title.trim()) {
      setProblem(REFERENCE_CONTENT_MESSAGES.missingTitle)
      titleRef.current?.focus()
      return
    }
    if (!content.trim()) {
      setProblem(REFERENCE_CONTENT_MESSAGES.missingContent)
      contentRef.current?.focus()
      return
    }
    setProblem(null)
    onSave({ title, content })
  }

  return (
    <Modal
      title={item ? "Edit saved content" : "Add saved content"}
      description="Give it a name you will recognise later, then paste the steps, instructions or explanation."
      onClose={onClose}
      isCloseDisabled={isSaving}
      size="default"
      initialFocusRef={titleRef}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-[20px] text-xs" aria-live="polite">
            {(problem ?? error) && (
              <p role="alert" className="text-error">
                {problem ?? error}
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
              {isSaving ? "Saving..." : item ? "Save changes" : "Save content"}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reference-title" className={labelClass}>
            Name
          </label>
          <input
            id="reference-title"
            ref={titleRef}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              if (problem) setProblem(null)
            }}
            maxLength={REFERENCE_TITLE_MAX_LENGTH}
            disabled={isSaving}
            placeholder="e.g. How to create an OpenAI API key and set a spend limit"
            className={`${fieldClass} py-2.5`}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="reference-content" className={labelClass}>
              Content
            </label>
            <span className="text-[11px] text-outline">
              {content.length.toLocaleString()} / {REFERENCE_CONTENT_MAX_LENGTH.toLocaleString()}
            </span>
          </div>
          <textarea
            id="reference-content"
            ref={contentRef}
            value={content}
            onChange={(event) => {
              setContent(event.target.value)
              if (problem) setProblem(null)
            }}
            maxLength={REFERENCE_CONTENT_MAX_LENGTH}
            disabled={isSaving}
            placeholder="Paste the steps, the procedure or the explanation exactly as you want to send it."
            className={`${fieldClass} min-h-[260px] flex-1 resize-none py-3 leading-relaxed`}
          />
        </div>
      </div>
    </Modal>
  )
}
