"use client"

import React from "react"
import { Check, Copy } from "lucide-react"
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard"

interface CopyTaskTextProps {
  // The task's own line, which is what lands on the clipboard
  text: string
  label: string
  className?: string
  size?: number
}

/**
 * Copies one task's line, so it can be pasted anywhere (WhatsApp, a message, a document). It copies
 * the text and nothing else: a second task is never made, which is what the copy icon used to do
 * (that is the duplicate button beside it now).
 *
 * Every press stops here rather than reaching the row, because a daily task's whole row is what
 * starts a drag and a click on it ticks the task.
 */
export const CopyTaskText: React.FC<CopyTaskTextProps> = ({ text, label, className = "", size = 15 }) => {
  const { copied, copy } = useCopyToClipboard()
  const stop = (event: React.SyntheticEvent) => event.stopPropagation()
  return (
    <button
      type="button"
      onPointerDown={stop}
      onMouseDown={stop}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void copy(text)
      }}
      aria-label={label}
      title={copied ? "Copied" : label}
      className={`${className} ${copied ? "text-primary" : ""}`}
    >
      {copied ? <Check size={size} aria-hidden="true" /> : <Copy size={size} aria-hidden="true" />}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </button>
  )
}
