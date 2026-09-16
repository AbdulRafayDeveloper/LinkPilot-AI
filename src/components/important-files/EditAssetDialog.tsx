"use client"

import React, { useRef, useState } from "react"
import { Loader2, Save } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import {
  ASSET_DESCRIPTION_MAX_LENGTH,
  ASSET_NAME_MAX_LENGTH,
  IMPORTANT_FILES_MESSAGES,
} from "@/constants/importantFiles"
import type { Asset, AssetMetadataInput } from "@/types/importantFiles"

interface EditAssetDialogProps {
  asset: Asset
  isSaving: boolean
  error: string | null
  onSave: (input: AssetMetadataInput) => void
  onClose: () => void
}

const labelClass = "text-[10px] font-bold uppercase tracking-wider text-outline"
const fieldClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[13px] text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"

/**
 * Changes what the file is called and what it says about itself. The file itself is not part of
 * this form: editing a name never replaces, re-uploads or touches what is stored.
 */
export const EditAssetDialog: React.FC<EditAssetDialogProps> = ({ asset, isSaving, error, onSave, onClose }) => {
  const [name, setName] = useState(asset.name)
  const [description, setDescription] = useState(asset.description)
  const [problem, setProblem] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const submit = () => {
    if (isSaving) return
    if (!name.trim()) {
      setProblem(IMPORTANT_FILES_MESSAGES.missingName)
      nameRef.current?.focus()
      return
    }
    setProblem(null)
    onSave({ name: name.trim(), description: description.trim() })
  }

  return (
    <Modal
      title="Edit file details"
      description="Only the name and description change here. The file itself stays exactly as you uploaded it."
      onClose={onClose}
      isCloseDisabled={isSaving}
      size="default"
      initialFocusRef={nameRef}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-[20px] text-xs" aria-live="polite">
            {(problem || error) && (
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
              {isSaving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-asset-name" className={labelClass}>
            Name
          </label>
          <input
            id="edit-asset-name"
            ref={nameRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={ASSET_NAME_MAX_LENGTH}
            disabled={isSaving}
            aria-invalid={problem === IMPORTANT_FILES_MESSAGES.missingName}
            className={`${fieldClass} py-2.5`}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-asset-description" className={labelClass}>
            Description (optional)
          </label>
          <textarea
            id="edit-asset-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={ASSET_DESCRIPTION_MAX_LENGTH}
            disabled={isSaving}
            rows={4}
            className={`${fieldClass} resize-none py-2.5 leading-relaxed`}
          />
          <p className="text-[11px] text-outline">
            Stored file: {asset.originalName} · unchanged by this form
          </p>
        </div>
      </div>
    </Modal>
  )
}
