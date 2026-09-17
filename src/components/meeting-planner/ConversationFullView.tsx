"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AArrowDown, AArrowUp, X } from "lucide-react"
import type { ScriptStage } from "@/types/meetingPlanner"
import { ConversationScript, type ScriptTextSize } from "./ConversationScript"

const SIZES: ScriptTextSize[] = ["regular", "large", "larger"]
const SIZE_KEY = "meetingPlanner:fullViewTextSize"

const readSize = (): ScriptTextSize => {
  try {
    const stored = window.localStorage.getItem(SIZE_KEY)
    return SIZES.includes(stored as ScriptTextSize) ? (stored as ScriptTextSize) : "large"
  } catch {
    return "large"
  }
}

/**
 * The conversation on its own, for reading during the call: it opens straight into the browser's own
 * full screen (the click that opened it is what allows that; a browser that refuses still gets the
 * whole window), with larger text in three sizes, remembered in this browser. There is no header
 * bar, so every line of the screen is the conversation and a long line stays on one line; the only
 * controls float over the top corner. The view is the full screen, so leaving full screen closes it:
 * one press of Escape is enough, and so is the cross.
 */
export const ConversationFullView: React.FC<{
  title: string
  stages: ScriptStage[]
  projectLinks?: Record<string, string>
  onClose: () => void
}> = ({
  title,
  stages,
  projectLinks,
  onClose,
}) => {
  const [size, setSize] = useState<ScriptTextSize>(readSize)
  const panel = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)

  const changeSize = (step: number) => {
    const next = SIZES[Math.min(SIZES.length - 1, Math.max(0, SIZES.indexOf(size) + step))]
    setSize(next)
    try {
      window.localStorage.setItem(SIZE_KEY, next)
    } catch {
      // The size simply isn't remembered
    }
  }

  const close = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    onClose()
  }, [onClose])

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    // Full screen straight away, on the activation of the click that opened this. A browser that
    // refuses simply leaves the view filling the window, which is what it already does
    if (!document.fullscreenElement) void panel.current?.requestFullscreen?.().catch(() => undefined)
    // Focus on the reading area, so the arrow keys, Page Down and Space scroll it straight away
    scroller.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (event: KeyboardEvent) => {
      // Outside full screen (a browser that refused it, or one already left) Escape closes the view
      if (event.key === "Escape" && !document.fullscreenElement) close()
    }
    // Inside full screen the browser takes Escape to leave it; since the view is the full screen,
    // leaving it closes the view too, so one press is always enough
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) close()
    }
    window.addEventListener("keydown", onKey)
    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () => {
      window.removeEventListener("keydown", onKey)
      document.removeEventListener("fullscreenchange", onFullscreenChange)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [close])

  const iconButton =
    "flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-40"

  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-label={`Conversation: ${title}`}
      className="fixed inset-0 z-[80] flex flex-col bg-background"
    >
      {/* Floating over the conversation, so the controls cost the reading area no height at all */}
      <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-xl border border-outline-variant/70 bg-white/85 p-0.5 opacity-50 shadow-sm backdrop-blur-sm transition-opacity hover:opacity-100 focus-within:opacity-100 sm:right-3 sm:top-3">
        <button type="button" onClick={() => changeSize(-1)} disabled={size === SIZES[0]} aria-label="Smaller text" title="Smaller text" className={iconButton}>
          <AArrowDown size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => changeSize(1)}
          disabled={size === SIZES[SIZES.length - 1]}
          aria-label="Larger text"
          title="Larger text"
          className={iconButton}
        >
          <AArrowUp size={18} aria-hidden="true" />
        </button>
        <button type="button" onClick={close} aria-label="Close the conversation (Escape)" title="Close (Escape)" className={iconButton}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div ref={scroller} tabIndex={-1} className="custom-scrollbar flex-1 overflow-y-auto overscroll-contain focus:outline-none">
        {/* The whole width, less a small margin, so a long line stays on one line */}
        <div className="px-2 py-3 sm:px-4 sm:py-4">
          <ConversationScript stages={stages} size={size} anchorPrefix="full" projectLinks={projectLinks} />
          <p className="py-8 text-center text-[12px] text-outline">End of the conversation</p>
        </div>
      </div>
    </div>,
    document.body
  )
}
