"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Check, EllipsisVertical, Loader2 } from "lucide-react"

/** One thing the menu can do: a word, an icon, and what happens when it is chosen. */
export interface ActionMenuItem {
  id: string
  label: string
  icon: React.ReactNode
  onSelect: () => void
  disabled?: boolean
  // Why it is disabled, or a word more on what it does, as the row's tooltip
  hint?: string
  // Delete reads in the error colour, so it is never chosen by mistake for the item above it
  tone?: "default" | "danger"
  // For a choice out of a short list (how often a task repeats): the one that is on carries a tick
  checked?: boolean
}

/** A run of items under one heading; the heading is left out when the group has none. */
export interface ActionMenuGroup {
  id: string
  heading?: string
  items: ActionMenuItem[]
}

interface ActionMenuProps {
  // What the menu is about, for a screen reader ("Actions for: Write the report")
  label: string
  groups: ActionMenuGroup[]
  // A row whose own write is still running: the button is a spinner and nothing can be chosen
  isBusy?: boolean
  // The button alone, with no menu to open: the copy of a row that follows the pointer during a drag
  isPlaceholder?: boolean
  className?: string
}

// What the menu takes up, so it can be placed before it is drawn and clamped inside the window
const MENU_WIDTH = 224
const ITEM_HEIGHT = 36
const HEADING_HEIGHT = 26
const MENU_PADDING = 10

const menuHeightOf = (groups: ActionMenuGroup[]) =>
  groups.reduce((height, group) => height + (group.heading ? HEADING_HEIGHT : 0) + group.items.length * ITEM_HEIGHT, MENU_PADDING)

/**
 * A three-dot button that opens everything a row can do, each thing with its word and its icon,
 * at the owner's request: a row of six bare icons could not be read, and a word beside each one can.
 *
 * It is rendered in a portal on `document.body` and placed from the button's own rectangle (the
 * rule `MeetingStatusButton` follows), because the rows live in lists that scroll and a menu drawn
 * inside one was cut off; it is positioned once, so a scroll or a resize closes it rather than
 * leaving it floating away from its button. A click anywhere else and Escape close it too.
 *
 * Every press on the button stops where it is, because a daily task's whole row is the drag area
 * and a click on it ticks the task. Inside the menu the arrow keys move between the items, Home and
 * End jump, and Enter or Space chooses, as a menu is expected to work.
 */
export const ActionMenu: React.FC<ActionMenuProps> = ({ label, groups, isBusy = false, isPlaceholder = false, className = "" }) => {
  const [menuAt, setMenuAt] = useState<{ top: number; left: number } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const isOpen = menuAt !== null

  const close = useCallback(() => setMenuAt(null), [])

  const open = () => {
    const rect = button.current?.getBoundingClientRect()
    if (!rect) return
    // A menu taller than the window (a phone on its side) is as tall as the window and scrolls inside
    const height = Math.min(menuHeightOf(groups), window.innerHeight - 16)
    // Below the button, or above it when the window has no room, then clamped on every edge
    const roomBelow = window.innerHeight - rect.bottom - 8
    const preferred = roomBelow >= height ? rect.bottom + 4 : rect.top - height - 4
    setMenuAt({
      top: Math.max(8, Math.min(preferred, window.innerHeight - height - 8)),
      left: Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
    })
  }

  // The first item takes focus as the menu opens, so the keyboard is inside it at once
  useEffect(() => {
    if (!isOpen) return
    const first = menu.current?.querySelector<HTMLButtonElement>("[role^='menuitem']:not(:disabled)")
    first?.focus()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!button.current?.contains(target) && !menu.current?.contains(target)) close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close()
        button.current?.focus()
      }
    }
    // Scrolling the page moves the button away from the menu, so it closes; scrolling the menu itself does not
    const onScroll = (event: Event) => {
      if (!menu.current?.contains(event.target as Node)) close()
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    window.addEventListener("scroll", onScroll, true)
    window.addEventListener("resize", close)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("resize", close)
    }
  }, [isOpen, close])

  const stop = (event: React.SyntheticEvent) => event.stopPropagation()

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>("[role^='menuitem']:not(:disabled)") ?? [])]
    if (items.length === 0) return
    const at = items.indexOf(document.activeElement as HTMLButtonElement)
    const to =
      event.key === "ArrowDown" ? (at + 1) % items.length : event.key === "ArrowUp" ? (at - 1 + items.length) % items.length : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : null
    if (to === null) return
    event.preventDefault()
    items[to]?.focus()
  }

  const choose = (item: ActionMenuItem) => {
    close()
    button.current?.focus()
    item.onSelect()
  }

  const buttonClass = `mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${className}`

  if (isPlaceholder || isBusy) {
    return (
      <span className={`${buttonClass} text-outline`} aria-hidden="true">
        {isBusy ? <Loader2 size={15} className="animate-spin" /> : <EllipsisVertical size={16} />}
      </span>
    )
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        onPointerDown={stop}
        onMouseDown={stop}
        onClick={(event) => {
          event.stopPropagation()
          if (isOpen) close()
          else open()
        }}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Actions: ${label}`}
        title="More actions"
        className={`${buttonClass} ${isOpen ? "bg-primary/10 text-primary" : "text-outline hover:bg-primary/10 hover:text-primary"}`}
      >
        <EllipsisVertical size={16} aria-hidden="true" />
      </button>

      {menuAt &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            aria-label={`Actions: ${label}`}
            onKeyDown={onMenuKeyDown}
            onPointerDown={stop}
            style={{ top: menuAt.top, left: menuAt.left, width: MENU_WIDTH, maxHeight: "calc(100dvh - 16px)" }}
            className="custom-scrollbar fixed z-[70] overflow-y-auto overflow-x-hidden rounded-xl border border-outline-variant bg-white py-1 shadow-lg"
          >
            {groups.map((group, index) => (
              <div key={group.id} className={index > 0 ? "mt-1 border-t border-outline-variant/70 pt-1" : ""}>
                {group.heading && <p className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-outline">{group.heading}</p>}
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role={item.checked === undefined ? "menuitem" : "menuitemradio"}
                    aria-checked={item.checked}
                    onClick={() => choose(item)}
                    disabled={item.disabled}
                    title={item.hint}
                    className={`flex h-9 w-full items-center gap-2.5 px-3 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-40 ${
                      item.tone === "danger" ? "text-error hover:bg-error/10" : "text-on-surface hover:bg-surface-container-low"
                    } ${item.checked ? "bg-surface-container-low font-semibold" : ""}`}
                  >
                    <span className={`flex w-4 shrink-0 justify-center ${item.tone === "danger" ? "text-error" : "text-on-surface-variant"}`} aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.checked && <Check size={14} className="shrink-0 text-primary" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  )
}
