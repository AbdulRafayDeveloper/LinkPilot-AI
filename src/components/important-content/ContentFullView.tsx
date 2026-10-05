"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AArrowDown, AArrowUp, FolderOpen, Pencil, X } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import { RichTextView } from "@/components/ui/RichTextView"
import { CONTENT_TEXT_SIZES, DEFAULT_CONTENT_TEXT_SIZE } from "@/constants/importantContent"
import type { ImportantContent } from "@/types/importantContent"

const SIZE_KEY = "importantContent:fullViewTextSize"

const readSize = (saved: number): number => {
  try {
    const stored = Number(window.localStorage.getItem(SIZE_KEY))
    return (CONTENT_TEXT_SIZES as readonly number[]).includes(stored) ? stored : saved
  } catch {
    return saved
  }
}

/**
 * One entry on its own over the whole screen, which is how it is read: it opens straight into the
 * browser's own full screen (the click that opened it is what allows that; a browser that refuses
 * still gets the whole window), and the text is read at two to four sizes larger than the list,
 * remembered in this browser. It is modelled on the meeting conversation's full view
 * (`components/meeting-planner/ConversationFullView.tsx`): no header bar, so every line of the
 * screen is the entry itself, with the name and the only controls floating over the top. The view
 * **is** the full screen, so leaving full screen closes it and one press of Escape is always enough.
 */
export const ContentFullView: React.FC<{
  entry: ImportantContent
  onEdit: () => void
  onClose: () => void
}> = ({ entry, onEdit, onClose }) => {
  const [size, setSize] = useState<number>(() => readSize(entry.textSize || DEFAULT_CONTENT_TEXT_SIZE))
  const panel = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)

  const changeSize = (step: number) => {
    const sizes = CONTENT_TEXT_SIZES as readonly number[]
    const next = sizes[Math.min(sizes.length - 1, Math.max(0, sizes.indexOf(size) + step))]
    setSize(next)
    try {
      window.localStorage.setItem(SIZE_KEY, String(next))
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

  const sizes = CONTENT_TEXT_SIZES as readonly number[]
  const iconButton =
    "flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-40"

  return createPortal(
    <div ref={panel} role="dialog" aria-modal="true" aria-label={`Content: ${entry.name}`} className="fixed inset-0 z-[80] flex flex-col bg-background">
      {/* Floating over the text, so the controls cost the reading area no height at all */}
      <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-xl border border-outline-variant/70 bg-white/85 p-0.5 opacity-60 shadow-sm backdrop-blur-sm transition-opacity hover:opacity-100 focus-within:opacity-100 sm:right-3 sm:top-3">
        <button type="button" onClick={() => changeSize(-1)} disabled={size === sizes[0]} aria-label="Smaller text" title="Smaller text" className={iconButton}>
          <AArrowDown size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => changeSize(1)}
          disabled={size === sizes[sizes.length - 1]}
          aria-label="Larger text"
          title="Larger text"
          className={iconButton}
        >
          <AArrowUp size={18} aria-hidden="true" />
        </button>
        {entry.description && <CopyButton text={entry.description} label={`Copy the description of ${entry.name}`} />}
        <button type="button" onClick={onEdit} aria-label={`Edit ${entry.name}`} title="Edit" className={iconButton}>
          <Pencil size={17} aria-hidden="true" />
        </button>
        <button type="button" onClick={close} aria-label="Close (Escape)" title="Close (Escape)" className={iconButton}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div ref={scroller} tabIndex={-1} className="custom-scrollbar flex-1 overflow-y-auto overscroll-contain focus:outline-none">
        {/* The whole width, less a small margin, so a long line stays on one line */}
        <div className="px-3 py-4 sm:px-5 sm:py-5">
          {/* The controls float at the top right, so the name keeps clear of them at every width:
              five buttons are about 176px, which is what this padding leaves them */}
          <header className="mb-4 flex flex-wrap items-center gap-2 pr-44 sm:pr-48">
            <h1 className="min-w-0 break-words text-xl font-bold text-on-surface sm:text-2xl">{entry.name}</h1>
            <span className="inline-flex max-w-full truncate rounded-full bg-primary-fixed/70 px-2 py-0.5 text-[11px] font-semibold text-on-primary-fixed-variant">
              {entry.type}
            </span>
            {entry.folder && (
              <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-outline-variant px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">
                <FolderOpen size={12} aria-hidden="true" />
                {entry.folder.name}
              </span>
            )}
          </header>

          {entry.description ? (
            <RichTextView text={entry.description} fontSize={size} showImages />
          ) : (
            <p className="rounded-xl border border-dashed border-outline-variant p-4 text-[13px] text-outline">No description saved.</p>
          )}
          <p className="py-8 text-center text-[12px] text-outline">End of this content</p>
        </div>
      </div>
    </div>,
    document.body
  )
}
