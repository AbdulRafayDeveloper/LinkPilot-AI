"use client"

import React, { useEffect, useRef, useState } from "react"
import { Check, Copy, Loader2, X } from "lucide-react"
import { copyFileToClipboard, type CopyKind } from "@/lib/copyFile"
import { COPY_FILE_MESSAGES } from "@/constants/copyFile"

interface CopyFileButtonProps {
  // A signed link the file can be read from
  url: string
  kind: CopyKind
  // Said to a screen reader and in the tooltip: "Copy screenshot.png"
  name: string
  // The icon alone, for a thumbnail; otherwise the icon and the word, as a row action
  iconOnly?: boolean
  className?: string
}

// How long "Copied" or "Couldn't copy" stays before the button reads Copy again
const FLASH_MS = 2500

/**
 * Copies a stored image (as the picture) or text file (as its text) to the clipboard, ready to
 * paste into Claude, WhatsApp or anywhere else. Says whether it worked, on the button itself.
 *
 * Every press stops at the button, because it sits inside rows whose whole surface may be a drag
 * handle or a link that opens the image.
 */
export const CopyFileButton: React.FC<CopyFileButtonProps> = ({ url, kind, name, iconOnly = false, className = "" }) => {
  const [state, setState] = useState<"idle" | "copying" | "copied" | "failed">("idle")
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    []
  )

  const copy = async (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (state === "copying") return
    setState("copying")
    const copied = await copyFileToClipboard(url, kind)
    setState(copied ? "copied" : "failed")
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setState("idle"), FLASH_MS)
  }

  const label =
    state === "copied"
      ? COPY_FILE_MESSAGES.copied
      : state === "failed"
        ? COPY_FILE_MESSAGES.failed
        : kind === "image"
          ? COPY_FILE_MESSAGES.copyImage
          : COPY_FILE_MESSAGES.copyText
  const icon =
    state === "copying" ? (
      <Loader2 size={13} className="animate-spin" aria-hidden="true" />
    ) : state === "copied" ? (
      <Check size={13} className="text-success" aria-hidden="true" />
    ) : state === "failed" ? (
      <X size={13} className="text-error" aria-hidden="true" />
    ) : (
      <Copy size={13} aria-hidden="true" />
    )

  return (
    <button
      type="button"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={copy}
      aria-label={`${label}: ${name}`}
      title={state === "failed" ? COPY_FILE_MESSAGES.failedHint : `${label}: ${name}`}
      className={className}
    >
      {icon}
      {!iconOnly && label}
      {iconOnly && (
        <span role="status" className="sr-only">
          {state === "copied" || state === "failed" ? label : ""}
        </span>
      )}
    </button>
  )
}
