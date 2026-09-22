"use client"

import React, { useEffect, useId, useRef } from "react"
import { X } from "lucide-react"

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  title: string
  description?: string
  onClose: () => void
  isCloseDisabled?: boolean
  footer?: React.ReactNode
  initialFocusRef?: React.RefObject<HTMLElement | null>
  // Every popup opens at the Update Prompt size (POPUP_PANEL), except "editor", a writing page that is
  // wide and tall but with a margin all round, so it never reads as full screen. "large" and "editor"
  // lay the body out as a flex column; the other sizes keep their content in normal flow
  size?: "compact" | "default" | "large" | "editor"
  children: React.ReactNode
}

// The Update Prompt panel: nearly the whole screen, with a small margin all round
const POPUP_PANEL = "w-full max-w-[min(95vw,1600px)] h-[92dvh]"

const PANEL_SIZE = {
  compact: POPUP_PANEL,
  default: POPUP_PANEL,
  large: POPUP_PANEL,
  // 2rem above and below on a laptop, 1.5rem on a phone, centred, never wider than a comfortable page
  editor: "w-full max-w-[min(94vw,1240px)] h-[calc(100dvh-3rem)] sm:h-[calc(100dvh-4rem)] max-h-[1000px]",
} as const

/**
 * Accessible dialog: Escape and backdrop close it, Tab stays inside it, and focus
 * returns to the element that opened it. Render it conditionally to open it.
 */
export const Modal: React.FC<ModalProps> = ({
  title,
  description,
  onClose,
  isCloseDisabled = false,
  footer,
  initialFocusRef,
  size = "default",
  children,
}) => {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const isCloseDisabledRef = useRef(isCloseDisabled)

  useEffect(() => {
    onCloseRef.current = onClose
    isCloseDisabledRef.current = isCloseDisabled
  }, [onClose, isCloseDisabled])

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    const firstFocusable = dialog?.querySelector<HTMLElement>(FOCUSABLE)
    ;(initialFocusRef?.current ?? firstFocusable ?? dialog)?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isCloseDisabledRef.current) {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== "Tab" || !dialog) return
      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [initialFocusRef])

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isCloseDisabled) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`bg-white rounded-2xl ${PANEL_SIZE[size]} flex flex-col border border-outline-variant shadow-xl outline-none`}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3 border-b border-outline-variant/60 shrink-0">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-on-surface">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isCloseDisabled}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        <div
          className={`flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 ${size === "large" || size === "editor" ? "flex flex-col" : ""}`}
        >
          {children}
        </div>

        {footer && <div className="px-5 py-4 border-t border-outline-variant/60 shrink-0">{footer}</div>}
      </div>
    </div>
  )
}
