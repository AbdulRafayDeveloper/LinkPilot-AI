"use client"

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { AArrowDown, AArrowUp, Maximize, Minimize, X } from "lucide-react"
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

const subscribeToFullscreen = (listener: () => void) => {
  document.addEventListener("fullscreenchange", listener)
  return () => document.removeEventListener("fullscreenchange", listener)
}

/**
 * The conversation on its own, filling the screen, for reading during the call: larger text (three
 * sizes, remembered in this browser), a stage picker to jump straight to a stage, and the
 * browser's own full screen where it allows it. Escape or Close returns to the meeting page.
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
  const isFullscreen = useSyncExternalStore(
    subscribeToFullscreen,
    () => Boolean(document.fullscreenElement),
    () => false
  )

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

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    else void panel.current?.requestFullscreen?.().catch(() => undefined)
  }

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    // Focus on the reading area, so the arrow keys, Page Down and Space scroll it straight away
    scroller.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (event: KeyboardEvent) => {
      // In the browser's own full screen, Escape leaves full screen first and the view stays open
      if (event.key === "Escape" && !document.fullscreenElement) close()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [close])

  const jumpTo = (id: string) => {
    document.getElementById(`full-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const iconButton =
    "flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-40"

  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-label={`Conversation: ${title}`}
      className="fixed inset-0 z-[80] flex flex-col bg-background"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-outline-variant bg-white px-3 py-2 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-outline">Conversation</p>
          <h2 className="truncate text-[15px] font-bold text-on-surface">{title}</h2>
        </div>
        {stages.length > 1 && (
          <select
            aria-label="Jump to a stage"
            defaultValue=""
            onChange={(event) => {
              if (event.target.value) jumpTo(event.target.value)
              event.target.value = ""
            }}
            className="max-w-[45vw] rounded-lg border border-outline-variant bg-white px-2 py-1.5 text-[13px] font-semibold text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          >
            <option value="">Jump to stage</option>
            {stages.map((stage, index) => (
              <option key={stage.id} value={stage.id}>
                {index + 1}. {stage.title}
              </option>
            ))}
          </select>
        )}
        <div className="flex items-center">
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
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Leave full screen" : "Full screen"}
            title={isFullscreen ? "Leave full screen" : "Full screen"}
            className={`${iconButton} hidden sm:flex`}
          >
            {isFullscreen ? <Minimize size={17} aria-hidden="true" /> : <Maximize size={17} aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={close}
            className="ml-1 inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-[13px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
          >
            <X size={15} aria-hidden="true" />
            Close
          </button>
        </div>
      </div>
      <div ref={scroller} tabIndex={-1} className="custom-scrollbar flex-1 overflow-y-auto overscroll-contain focus:outline-none">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
          <ConversationScript stages={stages} size={size} anchorPrefix="full" projectLinks={projectLinks} />
          <p className="py-8 text-center text-[12px] text-outline">End of the conversation</p>
        </div>
      </div>
    </div>,
    document.body
  )
}
