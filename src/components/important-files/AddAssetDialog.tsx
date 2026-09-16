"use client"

import React, { useRef, useState } from "react"
import { Loader2, Paperclip, Upload } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import {
  ACCEPTED_CONTENT_TYPES,
  ASSET_DESCRIPTION_MAX_LENGTH,
  ASSET_NAME_MAX_LENGTH,
  IMPORTANT_FILES_MESSAGES,
  MULTIPART_THRESHOLD_BYTES,
  categoryForContentType,
  getCategoryLabel,
  maxBytesFor,
} from "@/constants/importantFiles"
import type { UploadProgress } from "@/types/importantFiles"

interface AddAssetDialogProps {
  progress: UploadProgress | null
  onUpload: (file: File, metadata: { name: string; description: string }) => void
  onCancelUpload: () => void
  onClose: () => void
}

const labelClass = "text-[10px] font-bold uppercase tracking-wider text-outline"
const fieldClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[13px] text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB"]
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value >= 10 || Number.isInteger(value) ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

const STAGE_TEXT = {
  preparing: "Getting the upload ready...",
  uploading: "Uploading to storage...",
  finishing: "Finishing off...",
  done: "Saved.",
  failed: "The upload stopped.",
  cancelled: "Upload cancelled.",
} as const

/**
 * Adds one file: choose it, name it in your own words, describe it if it helps, and upload.
 *
 * The name is yours and has nothing to do with the file's own name. Anything over the
 * four megabyte threshold goes up in parts, straight to storage, and the bar follows the bytes
 * storage has actually taken, so a large video shows real progress rather than a spinner.
 */
export const AddAssetDialog: React.FC<AddAssetDialogProps> = ({ progress, onUpload, onCancelUpload, onClose }) => {
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [problem, setProblem] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const isBusy = progress !== null && ["preparing", "uploading", "finishing"].includes(progress.stage)
  const category = file ? categoryForContentType(file.type) : null

  const chooseFile = (chosen: File | null) => {
    setProblem(null)
    if (!chosen) {
      setFile(null)
      return
    }
    const chosenCategory = categoryForContentType(chosen.type)
    if (!chosenCategory) {
      setFile(null)
      setProblem(IMPORTANT_FILES_MESSAGES.unsupportedType)
      return
    }
    if (chosen.size > maxBytesFor(chosenCategory)) {
      setFile(null)
      setProblem(`${getCategoryLabel(chosenCategory)} files can be up to ${formatBytes(maxBytesFor(chosenCategory))}.`)
      return
    }
    setFile(chosen)
  }

  const submit = () => {
    if (isBusy) return
    if (!file) {
      setProblem(IMPORTANT_FILES_MESSAGES.missingFile)
      fileRef.current?.focus()
      return
    }
    if (!name.trim()) {
      setProblem(IMPORTANT_FILES_MESSAGES.missingName)
      nameRef.current?.focus()
      return
    }
    setProblem(null)
    onUpload(file, { name: name.trim(), description: description.trim() })
  }

  return (
    <Modal
      title="Add a file"
      description="Keep an image, PDF, Word file, text file, video or audio here, under a name you will recognise later."
      onClose={onClose}
      isCloseDisabled={isBusy}
      size="default"
      initialFocusRef={fileRef}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-[20px] text-xs" aria-live="polite">
            {(problem || progress?.error) && (
              <p role="alert" className="text-error">
                {problem ?? progress?.error}
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={isBusy ? onCancelUpload : onClose}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
            >
              {isBusy ? "Cancel upload" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={isBusy}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isBusy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
              {isBusy ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="asset-file" className={labelClass}>
            File
          </label>
          <input
            id="asset-file"
            ref={fileRef}
            type="file"
            accept={ACCEPTED_CONTENT_TYPES.join(",")}
            disabled={isBusy}
            onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
            className={`${fieldClass} py-2.5 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-container file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-on-primary-container`}
          />
          {file && category && (
            <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-outline">
              <Paperclip size={12} aria-hidden="true" />
              <span className="min-w-0 break-all">{file.name}</span>
              <span>
                · {getCategoryLabel(category)} · {formatBytes(file.size)}
                {file.size > MULTIPART_THRESHOLD_BYTES && " · uploaded in parts"}
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="asset-name" className={labelClass}>
            Name
          </label>
          <input
            id="asset-name"
            ref={nameRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={ASSET_NAME_MAX_LENGTH}
            disabled={isBusy}
            placeholder="What you want to call it, for example Passport scan"
            aria-invalid={problem === IMPORTANT_FILES_MESSAGES.missingName}
            className={`${fieldClass} py-2.5`}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="asset-description" className={labelClass}>
            Description (optional)
          </label>
          <textarea
            id="asset-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={ASSET_DESCRIPTION_MAX_LENGTH}
            disabled={isBusy}
            rows={3}
            placeholder="What it is for, or anything you want to remember about it."
            className={`${fieldClass} resize-none py-2.5 leading-relaxed`}
          />
        </div>

        {progress && (
          <div className="flex flex-col gap-1.5" aria-live="polite">
            <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
              <span>{STAGE_TEXT[progress.stage]}</span>
              <span>{progress.percent}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={progress.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Upload progress"
              className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high"
            >
              <div
                className={`h-full rounded-full transition-[width] duration-200 ${
                  progress.stage === "failed" ? "bg-error" : "bg-primary"
                }`}
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            {isBusy && (
              <p className="text-[11px] text-outline">
                The file goes straight to storage, so you can keep the app open while it finishes.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
