"use client"

import React from "react"
import { Check, Copy } from "lucide-react"
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard"

interface CopyButtonProps {
  text: string
  label: string
  showLabel?: boolean
  // "prominent" is a bordered button with a visible text label, for a primary copy action
  variant?: "subtle" | "prominent"
  // Visible text for the prominent variant; defaults to "Copy"
  buttonText?: string
  className?: string
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  text,
  label,
  showLabel = false,
  variant = "subtle",
  buttonText = "Copy",
  className = "",
}) => {
  const { copied, copy } = useCopyToClipboard()
  const isProminent = variant === "prominent"

  const variantClass = isProminent
    ? `gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${
        copied ? "border-primary bg-primary text-white" : "border-primary text-primary hover:bg-primary/5"
      }`
    : `gap-1 rounded-md p-1 text-[11px] ${copied ? "text-primary" : "text-outline hover:text-primary hover:bg-surface-container"}`

  return (
    <button
      type="button"
      onClick={() => copy(text)}
      aria-label={label}
      title={copied ? "Copied" : label}
      className={`inline-flex items-center shrink-0 font-semibold transition-colors ${variantClass} ${className}`}
    >
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {isProminent ? (
        <span>{copied ? "Copied!" : buttonText}</span>
      ) : (
        (showLabel || copied) && <span>{copied ? "Copied" : "Copy"}</span>
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </button>
  )
}
