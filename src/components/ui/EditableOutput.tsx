"use client"

import React, { useLayoutEffect, useRef, useState } from "react"
import { Bold, Undo2 } from "lucide-react"
import { containsLinkedInBold, toggleLinkedInBold } from "@/lib/linkedinBold"
import type { EditableText } from "@/lib/outputEdits"

interface EditableOutputProps {
  text: EditableText
  // What the text is, for screen readers ("Connection note")
  label: string
  // Subject lines: no line breaks
  singleLine?: boolean
  // The framed look; the default matches the tools' output quote
  className?: string
  textClassName?: string
  // Extra classes for the scrolling frame, e.g. a max height on small screens
  frameClassName?: string
}

const DEFAULT_FRAME = "border-l-2 border-primary bg-surface-container-lowest rounded-r-xl"
const toolButton =
  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"

/**
 * Generated text the user can change in place before copying it: click and type, or select
 * words and press Bold (or Ctrl/⌘+B) to make them bold the way LinkedIn shows bold
 * (lib/linkedinBold.ts). Bold goes through the browser's own editing, so Ctrl/⌘+Z undoes it;
 * "Undo changes" goes back to the generated text. The box grows with the text.
 */
export const EditableOutput: React.FC<EditableOutputProps> = ({
  text,
  label,
  singleLine = false,
  className = DEFAULT_FRAME,
  textClassName = "text-[15px] leading-relaxed",
  frameClassName = "",
}) => {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [hint, setHint] = useState<string | null>(null)
  const hasBold = containsLinkedInBold(text.value)

  // Grow to fit the text, so it reads like the output rather than a small form field
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    element.style.height = "auto"
    element.style.height = `${element.scrollHeight}px`
  }, [text.value])

  const toggleBold = () => {
    const element = ref.current
    if (!element) return
    const { selectionStart: start, selectionEnd: end, value } = element
    if (start === end) {
      setHint("Select the words to make bold first")
      return
    }
    const replacement = toggleLinkedInBold(value.slice(start, end))
    element.focus()
    // insertText keeps the change in the browser's undo history; the fallback sets the value directly
    const inserted = typeof document.execCommand === "function" && document.execCommand("insertText", false, replacement)
    if (!inserted) text.setValue(value.slice(0, start) + replacement + value.slice(end))
    requestAnimationFrame(() => element.setSelectionRange(start, start + replacement.length))
    setHint(null)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "b") {
      event.preventDefault()
      toggleBold()
    } else if (singleLine && event.key === "Enter") {
      event.preventDefault()
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          // Keeps the text selected while the button is pressed
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggleBold}
          aria-label="Bold the selected text"
          aria-keyshortcuts="Control+B Meta+B"
          title="Bold the selected text (Ctrl+B). It stays bold when pasted on LinkedIn."
          className={`${toolButton} border border-outline-variant bg-white text-on-surface hover:border-primary/40 hover:text-primary`}
        >
          <Bold size={13} aria-hidden="true" />
          Bold
        </button>
        {text.isEdited && (
          <button
            type="button"
            onClick={() => {
              text.reset()
              setHint(null)
            }}
            title="Go back to the generated text"
            className={`${toolButton} text-outline hover:bg-surface-container hover:text-primary`}
          >
            <Undo2 size={13} aria-hidden="true" />
            Undo changes
          </button>
        )}
        <span className="ml-auto text-[11px] text-outline" aria-live="polite">
          {hint ?? (text.isEdited ? "Edited" : "Click the text to edit")}
        </span>
      </div>

      <div className={`min-h-0 overflow-y-auto focus-within:ring-2 focus-within:ring-primary/30 ${className} ${frameClassName}`}>
        <textarea
          ref={ref}
          value={text.value}
          onChange={(event) => {
            text.setValue(singleLine ? event.target.value.replace(/\r?\n/g, " ") : event.target.value)
            if (hint) setHint(null)
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          spellCheck
          aria-label={`${label}, editable`}
          className={`block w-full resize-none overflow-hidden bg-transparent px-4 py-3 text-on-surface break-words focus:outline-none ${textClassName}`}
        />
      </div>

      {hasBold && <p className="text-[11px] text-outline">Bold letters count as 2 characters each on LinkedIn.</p>}
    </div>
  )
}
