"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { ImageUp, RefreshCw, Trash2 } from "lucide-react"
import { POST_IMAGE_MAX_BYTES, POST_IMAGE_TYPES, POST_INPUT_MESSAGES } from "@/constants/postInput"

interface ImageDropzoneProps {
  inputId: string
  file: File | null
  onSelect: (file: File) => void
  onRemove: () => void
  onReject: (message: string) => void
  // Smaller minimum height, for pages where the dropzone shares space with other inputs
  compact?: boolean
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
}

const MAX_SIZE_LABEL = `${POST_IMAGE_MAX_BYTES / (1024 * 1024)} MB`

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Screenshot picker: click to browse, drag and drop, or paste from the clipboard.
 * Shows a preview with Replace and Remove. The server re-checks the file's real type.
 */
export const ImageDropzone: React.FC<ImageDropzoneProps> = ({
  inputId,
  file,
  onSelect,
  onRemove,
  onReject,
  compact = false,
  disabled = false,
  invalid = false,
  describedBy,
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const minHeight = compact ? "min-h-[110px]" : "min-h-[160px]"
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const accept = useCallback(
    (candidate: File | undefined) => {
      if (!candidate || disabled) return
      if (!POST_IMAGE_TYPES.includes(candidate.type) || candidate.size === 0) {
        return onReject(POST_INPUT_MESSAGES.unsupportedImage)
      }
      if (candidate.size > POST_IMAGE_MAX_BYTES) return onReject(POST_INPUT_MESSAGES.imageTooLarge)
      onSelect(candidate)
    },
    [disabled, onReject, onSelect]
  )

  // A screenshot pasted anywhere on the page goes straight into the dropzone while it's open
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const pasted = Array.from(event.clipboardData?.files ?? []).find((item) => item.type.startsWith("image/"))
      if (!pasted) return
      event.preventDefault()
      accept(pasted)
    }
    window.addEventListener("paste", handlePaste)
    return () => window.removeEventListener("paste", handlePaste)
  }, [accept])

  const dropHandlers = {
    onDragOver: (event: React.DragEvent) => {
      event.preventDefault()
      if (!disabled) setIsDragging(true)
    },
    onDragLeave: () => setIsDragging(false),
    onDrop: (event: React.DragEvent) => {
      event.preventDefault()
      setIsDragging(false)
      accept(event.dataTransfer.files[0])
    },
  }

  const input = (
    <input
      ref={inputRef}
      id={inputId}
      type="file"
      accept={POST_IMAGE_TYPES.join(",")}
      disabled={disabled}
      aria-invalid={invalid}
      aria-describedby={describedBy}
      onChange={(event) => {
        accept(event.target.files?.[0])
        // Lets the same file be picked again after removing it
        event.target.value = ""
      }}
      className="sr-only"
    />
  )

  if (file && previewUrl) {
    return (
      <div className="flex flex-col gap-2 flex-1 min-h-0">
        <div
          {...dropHandlers}
          className={`relative flex-1 ${minHeight} rounded-xl border overflow-hidden bg-surface-container-low transition-colors ${
            isDragging ? "border-primary ring-2 ring-primary/30" : "border-outline-variant"
          }`}
        >
          <Image
            src={previewUrl}
            alt="Selected LinkedIn post screenshot"
            fill
            unoptimized
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-contain"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-[11px] text-outline" title={file.name}>
            {file.name} · {formatSize(file.size)}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            {input}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} aria-hidden="true" />
              Replace
            </button>
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-on-surface-variant hover:text-error hover:bg-error-container/50 transition-colors disabled:opacity-50"
            >
              <Trash2 size={13} aria-hidden="true" />
              Remove
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <label
      htmlFor={inputId}
      {...dropHandlers}
      className={`flex-1 ${minHeight} flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40 ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      } ${
        isDragging
          ? "border-primary bg-primary/5"
          : `${invalid ? "border-error" : "border-outline-variant"} bg-surface-container-lowest hover:bg-surface-container-low`
      }`}
    >
      {input}
      <span className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
        <ImageUp size={20} aria-hidden="true" />
      </span>
      <span className="text-sm font-semibold text-on-surface">
        Drop a screenshot here or <span className="text-primary underline underline-offset-2">browse</span>
      </span>
      <span className="text-[11px] text-outline">
        PNG, JPG or WEBP up to {MAX_SIZE_LABEL}. You can also paste it with Ctrl+V.
      </span>
    </label>
  )
}
