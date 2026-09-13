"use client"

import React, { useRef } from "react"
import { ClipboardPaste, ImagePlus } from "lucide-react"
import { POST_TEXT_MAX_LENGTH, type PostInputMode } from "@/constants/postInput"
import { ImageDropzone } from "./ImageDropzone"

const MODES: ReadonlyArray<{ id: PostInputMode; label: string; icon: typeof ClipboardPaste }> = [
  { id: "text", label: "Paste Post", icon: ClipboardPaste },
  { id: "image", label: "Upload Image", icon: ImagePlus },
]
const DEFAULT_PLACEHOLDER = "Paste the complete LinkedIn post content here..."

interface PostInputProps {
  // Unique per page; prefixes the element ids so labels and tabs stay linked
  idPrefix: string
  mode: PostInputMode
  onModeChange: (mode: PostInputMode) => void
  text: string
  onTextChange: (text: string) => void
  image: File | null
  onImageSelect: (file: File) => void
  onImageRemove: () => void
  onImageReject: (message: string) => void
  placeholder?: string
  // Marks the post as optional in both labels
  optional?: boolean
  // Smaller minimum heights, for pages where the post shares space with other inputs
  compact?: boolean
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
  textareaRef?: React.Ref<HTMLTextAreaElement>
}

/**
 * A LinkedIn post as pasted text or as a screenshot. Only the selected mode's input is
 * shown, and callers submit only that mode's value.
 */
export const PostInput: React.FC<PostInputProps> = ({
  idPrefix,
  mode,
  onModeChange,
  text,
  onTextChange,
  image,
  onImageSelect,
  onImageRemove,
  onImageReject,
  placeholder = DEFAULT_PLACEHOLDER,
  optional = false,
  compact = false,
  disabled = false,
  invalid = false,
  describedBy,
  textareaRef,
}) => {
  const tabRefs = useRef<Partial<Record<PostInputMode, HTMLButtonElement | null>>>({})
  const textInputId = `${idPrefix}-post-text`
  const imageInputId = `${idPrefix}-post-image`
  const panelId = `${idPrefix}-post-panel`
  const tabId = (inputMode: PostInputMode) => `${idPrefix}-post-tab-${inputMode}`
  const optionalSuffix = optional ? <span className="normal-case font-semibold tracking-normal"> (optional)</span> : null
  const labelClass = "text-[10px] font-bold text-outline uppercase tracking-wider"

  const handleTabKeyDown = (event: React.KeyboardEvent, index: number) => {
    const targetIndex = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: MODES.length - 1 }[event.key]
    if (targetIndex === undefined) return
    event.preventDefault()
    const target = MODES[(targetIndex + MODES.length) % MODES.length].id
    onModeChange(target)
    tabRefs.current[target]?.focus()
  }

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <div role="tablist" aria-label="Post input method" className="grid grid-cols-2 gap-1 bg-surface-container-low p-1 rounded-xl shrink-0">
        {MODES.map(({ id, label, icon: Icon }, index) => {
          const isActive = id === mode
          return (
            <button
              key={id}
              ref={(element) => {
                tabRefs.current[id] = element
              }}
              id={tabId(id)}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={panelId}
              tabIndex={isActive ? 0 : -1}
              disabled={disabled}
              onClick={() => onModeChange(id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs transition-colors ${
                isActive
                  ? "bg-white text-primary font-bold shadow-sm"
                  : "text-on-surface-variant font-semibold hover:text-on-surface hover:bg-white/60"
              }`}
            >
              <Icon size={14} aria-hidden="true" />
              {label}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" id={panelId} aria-labelledby={tabId(mode)} className="flex flex-col flex-1 min-h-0">
        {mode === "text" ? (
          <>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label htmlFor={textInputId} className={labelClass}>
                LinkedIn Post Content{optionalSuffix}
              </label>
              <span className="text-[11px] text-outline">
                {text.length.toLocaleString()} / {POST_TEXT_MAX_LENGTH.toLocaleString()}
              </span>
            </div>
            <textarea
              ref={textareaRef}
              id={textInputId}
              value={text}
              onChange={(event) => onTextChange(event.target.value)}
              maxLength={POST_TEXT_MAX_LENGTH}
              disabled={disabled}
              placeholder={placeholder}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              className={`flex-1 w-full resize-none rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-[13px] leading-relaxed text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-70 ${
                compact ? "min-h-[80px]" : "min-h-[180px] lg:min-h-[120px]"
              }`}
            />
          </>
        ) : (
          <>
            <label htmlFor={imageInputId} className={`${labelClass} mb-1.5`}>
              LinkedIn Post Screenshot{optionalSuffix}
            </label>
            <ImageDropzone
              inputId={imageInputId}
              file={image}
              onSelect={onImageSelect}
              onRemove={onImageRemove}
              onReject={onImageReject}
              compact={compact}
              disabled={disabled}
              invalid={invalid}
              describedBy={describedBy}
            />
          </>
        )}
      </div>
    </div>
  )
}
