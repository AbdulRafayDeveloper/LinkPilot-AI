"use client"

import React, { useEffect, useId, useRef, useState } from "react"
import { GripVertical } from "lucide-react"

interface SortableListProps<T> {
  items: T[]
  getId: (item: T) => string
  // What the handle and the announcements call an item
  getLabel: (item: T) => string
  onReorder: (ids: string[]) => void
  // The row itself; `handle` is the drag handle to place in it
  renderItem: (item: T, handle: React.ReactNode, isDragging: boolean) => React.ReactNode
  label: string
  className?: string
  disabled?: boolean
}

interface Drag {
  id: string
  from: number
  over: number
  // How far the dragged row has moved from where it started, scrolling included
  delta: number
  // How far every other row moves to make room: the dragged row's height plus the gap between rows
  step: number
}

interface Measure {
  pointerId: number
  startY: number
  startScroll: number
  // Each row's middle when the drag began, in page coordinates
  middles: number[]
  top: number
  height: number
  lastY: number
}

const EDGE = 72
const MAX_SPEED = 18

// The element that scrolls the list: the nearest scrolling ancestor, or the page
function scrollerOf(element: HTMLElement | null): HTMLElement {
  for (let node = element?.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) return node
  }
  return document.scrollingElement as HTMLElement
}

const move = (ids: string[], from: number, to: number) => {
  const next = [...ids]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/**
 * A list whose rows can be moved up and down by dragging their handle: with a mouse, a finger or a
 * pen (pointer events, so it works on phones), with the page scrolling itself near the edges, and
 * the other rows sliding out of the way. The handle also answers the arrow keys, one place at a
 * time, and every move is announced. No drag library; nothing else in the row starts a drag.
 */
export function SortableList<T>({ items, getId, getLabel, onReorder, renderItem, label, className = "", disabled = false }: SortableListProps<T>) {
  const [drag, setDragState] = useState<Drag | null>(null)
  // The same drag, readable from the pointer handlers without waiting for a render
  const dragRef = useRef<Drag | null>(null)
  const setDrag = (next: Drag | null) => {
    dragRef.current = next
    setDragState(next)
  }
  const [announcement, setAnnouncement] = useState("")
  const rows = useRef(new Map<string, HTMLLIElement>())
  const measure = useRef<Measure | null>(null)
  const scroller = useRef<HTMLElement | null>(null)
  const frame = useRef<number | null>(null)
  const refocus = useRef<string | null>(null)
  const hintId = useId()
  const ids = items.map(getId)

  const scrollTop = () => (scroller.current === document.scrollingElement ? window.scrollY : (scroller.current?.scrollTop ?? 0))

  // Where the dragged row is over, from the pointer's height
  const update = (clientY: number) => {
    const m = measure.current
    if (!m) return
    m.lastY = clientY
    const delta = clientY - m.startY + (scrollTop() - m.startScroll)
    const middle = m.top + m.height / 2 + delta
    const current = dragRef.current
    if (!current) return
    const over = m.middles.filter((value, index) => index !== current.from && value < middle).length
    setDrag({ ...current, delta, over })
  }

  // Near the top or bottom edge, the list scrolls, faster the closer the pointer is
  const autoScroll = () => {
    const m = measure.current
    const element = scroller.current
    if (!m || !element) return
    const isPage = element === document.scrollingElement
    const bounds = isPage ? { top: 0, bottom: window.innerHeight } : element.getBoundingClientRect()
    const speed = m.lastY < bounds.top + EDGE ? -((bounds.top + EDGE - m.lastY) / EDGE) * MAX_SPEED : m.lastY > bounds.bottom - EDGE ? ((m.lastY - (bounds.bottom - EDGE)) / EDGE) * MAX_SPEED : 0
    if (speed !== 0) {
      if (isPage) window.scrollBy(0, speed)
      else element.scrollTop += speed
      update(m.lastY)
    }
    frame.current = requestAnimationFrame(autoScroll)
  }

  const start = (event: React.PointerEvent<HTMLButtonElement>, id: string) => {
    if (disabled || (event.pointerType === "mouse" && event.button !== 0)) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const from = ids.indexOf(id)
    const rects = ids.map((rowId) => rows.current.get(rowId)?.getBoundingClientRect() ?? new DOMRect())
    const row = rects[from]
    const gap = rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0
    scroller.current = scrollerOf(rows.current.get(id) ?? null)
    measure.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startScroll: scrollTop(),
      middles: rects.map((rect) => rect.top + rect.height / 2),
      top: row.top,
      height: row.height,
      lastY: event.clientY,
    }
    setDrag({ id, from, over: from, delta: 0, step: row.height + gap })
    frame.current = requestAnimationFrame(autoScroll)
  }

  const finish = (commit: boolean) => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    measure.current = null
    const current = dragRef.current
    setDrag(null)
    if (current && commit && current.over !== current.from) {
      onReorder(move(ids, current.from, current.over))
      setAnnouncement(`Moved ${getLabel(items[current.from])} to position ${current.over + 1} of ${ids.length}.`)
    }
  }

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
  }, [])

  // Moving a row with the keyboard keeps focus on its handle
  useEffect(() => {
    const id = refocus.current
    if (!id) return
    refocus.current = null
    rows.current.get(id)?.querySelector<HTMLButtonElement>("[data-sortable-handle]")?.focus()
  })

  const onKey = (event: React.KeyboardEvent<HTMLButtonElement>, item: T, index: number) => {
    if (disabled || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return
    event.preventDefault()
    const to = event.key === "ArrowUp" ? index - 1 : index + 1
    if (to < 0 || to >= ids.length) return
    refocus.current = ids[index]
    onReorder(move(ids, index, to))
    setAnnouncement(`Moved ${getLabel(item)} to position ${to + 1} of ${ids.length}.`)
  }

  const offsetOf = (index: number) => {
    if (!drag || index === drag.from) return 0
    if (drag.from < drag.over && index > drag.from && index <= drag.over) return -drag.step
    if (drag.over < drag.from && index >= drag.over && index < drag.from) return drag.step
    return 0
  }

  return (
    <>
      {/* Nothing in the list gets selected as text while a row is dragged across it */}
      <ul className={`${className} ${drag ? "select-none" : ""}`} aria-label={label}>
        {items.map((item, index) => {
          const id = getId(item)
          const isDragging = drag?.id === id
          const handle = (
            <button
              type="button"
              data-sortable-handle
              disabled={disabled}
              onPointerDown={(event) => start(event, id)}
              onPointerMove={(event) => measure.current?.pointerId === event.pointerId && update(event.clientY)}
              onPointerUp={(event) => measure.current?.pointerId === event.pointerId && finish(true)}
              onPointerCancel={() => finish(false)}
              onKeyDown={(event) => onKey(event, item, index)}
              aria-label={`Move "${getLabel(item)}"`}
              aria-describedby={hintId}
              className={`flex h-8 w-7 shrink-0 touch-none items-center justify-center rounded-md text-outline transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-default disabled:opacity-40 ${
                isDragging ? "cursor-grabbing" : "cursor-grab"
              }`}
            >
              <GripVertical size={16} aria-hidden="true" />
            </button>
          )
          return (
            <li
              key={id}
              ref={(node) => {
                if (node) rows.current.set(id, node)
                else rows.current.delete(id)
              }}
              style={{
                transform: `translateY(${isDragging ? drag.delta : offsetOf(index)}px)`,
                transition: isDragging || !drag ? "none" : "transform 180ms cubic-bezier(0.2, 0, 0, 1)",
                position: "relative",
                zIndex: isDragging ? 20 : undefined,
              }}
              className={isDragging ? "rounded-xl shadow-xl ring-2 ring-primary/30" : ""}
            >
              {renderItem(item, handle, isDragging)}
            </li>
          )
        })}
      </ul>
      <span id={hintId} className="sr-only">
        Drag to move, or use the up and down arrow keys.
      </span>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </>
  )
}
