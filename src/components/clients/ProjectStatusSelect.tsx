"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown } from "lucide-react"
import { CLIENT_PROJECT_STATUSES, clientProjectStatus, type ClientProjectStatus } from "@/constants/clients"
import { ProjectStatusBadge } from "@/components/clients/ProjectStatusBadge"

interface ProjectStatusSelectProps {
  value: ClientProjectStatus
  onChange: (status: ClientProjectStatus) => void
  disabled?: boolean
  // The visible label's id, so the button is named by it
  labelId: string
}

// How tall the open list may be before it scrolls; each status is a name and a line under it
const MENU_MAX_HEIGHT = 360
const GAP = 4

/**
 * A project's status, as the app's own dropdown rather than a native `<select>`. A browser draws a
 * select's open list itself, from the operating system's colours, and in the dark scheme it came out
 * unreadable on the owner's machine whatever the page's CSS said. This one is built from the colour
 * tokens like every other menu here, so it reads the same in light and dark, and it shows each
 * status as the chip the lists use with what it means under it.
 *
 * The list is rendered in a portal and placed from the button, below it or above it where there is
 * more room, so the dialog's scrolling body can never clip it. Arrow keys, Home, End, Enter and
 * Escape work as they do on a select.
 */
export const ProjectStatusSelect: React.FC<ProjectStatusSelectProps> = ({ value, onChange, disabled = false, labelId }) => {
  const [place, setPlace] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null)
  const [active, setActive] = useState(0)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const isOpen = place !== null
  const chosen = clientProjectStatus(value)
  const listId = `${labelId}-list`

  const close = useCallback((refocus = false) => {
    setPlace(null)
    if (refocus) button.current?.focus()
  }, [])

  const open = () => {
    const rect = button.current?.getBoundingClientRect()
    if (!rect) return
    const below = window.innerHeight - rect.bottom - GAP - 8
    const above = rect.top - GAP - 8
    const opensBelow = below >= Math.min(MENU_MAX_HEIGHT, 240) || below >= above
    const maxHeight = Math.min(MENU_MAX_HEIGHT, opensBelow ? below : above)
    setActive(Math.max(0, CLIENT_PROJECT_STATUSES.findIndex((status) => status.id === value)))
    setPlace({
      top: opensBelow ? rect.bottom + GAP : rect.top - GAP - maxHeight,
      left: rect.left,
      width: rect.width,
      maxHeight,
    })
  }

  // Focus moves into the list as it opens, so the keys work at once
  useEffect(() => {
    if (isOpen) list.current?.focus()
  }, [isOpen])

  // The highlighted status stays in view as the arrows move through a list that scrolls
  useEffect(() => {
    if (isOpen) list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" })
  }, [isOpen, active])

  // A click elsewhere, the page scrolling under it or the window resizing closes it: it is placed
  // once, so it would otherwise float away from its button
  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!button.current?.contains(target) && !list.current?.contains(target)) close()
    }
    const onScroll = (event: Event) => {
      if (!list.current?.contains(event.target as Node)) close()
    }
    const onResize = () => close()
    document.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("scroll", onScroll, true)
    window.addEventListener("resize", onResize)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("resize", onResize)
    }
  }, [isOpen, close])

  const choose = (status: ClientProjectStatus) => {
    close(true)
    if (status !== value) onChange(status)
  }

  const onListKeyDown = (event: React.KeyboardEvent) => {
    const last = CLIENT_PROJECT_STATUSES.length - 1
    const moves: Record<string, number> = { ArrowDown: Math.min(active + 1, last), ArrowUp: Math.max(active - 1, 0), Home: 0, End: last }
    if (event.key in moves) {
      event.preventDefault()
      setActive(moves[event.key])
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      choose(CLIENT_PROJECT_STATUSES[active].id)
    } else if (event.key === "Escape") {
      // The dialog behind closes on Escape too; this one press only closes the list
      event.preventDefault()
      event.stopPropagation()
      close(true)
    } else if (event.key === "Tab") {
      close()
    }
  }

  const onButtonKeyDown = (event: React.KeyboardEvent) => {
    if (!isOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault()
      open()
    }
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        disabled={disabled}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={onButtonKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        aria-labelledby={`${labelId} ${labelId}-value`}
        className={`flex h-11 w-full items-center gap-2 rounded-xl border bg-surface-container-lowest px-3 text-left text-[14px] text-on-surface transition-colors focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60 ${
          isOpen ? "border-primary" : "border-outline-variant hover:bg-surface-container-low"
        }`}
      >
        <span id={`${labelId}-value`} className="min-w-0 flex-1 truncate font-semibold">
          {chosen.label}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-on-surface-variant transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {place &&
        createPortal(
          <ul
            ref={list}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={labelId}
            aria-activedescendant={`${listId}-${CLIENT_PROJECT_STATUSES[active].id}`}
            onKeyDown={onListKeyDown}
            style={{ top: place.top, left: place.left, width: place.width, maxHeight: place.maxHeight }}
            className="fixed z-[90] overflow-y-auto overscroll-contain rounded-xl border border-outline-variant bg-surface-container-lowest p-1 shadow-xl focus:outline-none"
          >
            {CLIENT_PROJECT_STATUSES.map((status, index) => {
              const isChosen = status.id === value
              return (
                <li
                  key={status.id}
                  id={`${listId}-${status.id}`}
                  data-index={index}
                  role="option"
                  aria-selected={isChosen}
                  onPointerEnter={() => setActive(index)}
                  onClick={() => choose(status.id)}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${index === active ? "bg-surface-container-high" : ""}`}
                >
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                    <ProjectStatusBadge status={status.id} />
                    <span className="text-[12px] leading-snug text-on-surface-variant">{status.description}</span>
                  </span>
                  {isChosen && <Check size={16} className="shrink-0 text-primary" aria-hidden="true" />}
                </li>
              )
            })}
          </ul>,
          document.body
        )}
    </>
  )
}
