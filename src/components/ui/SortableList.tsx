"use client"

import React, { useEffect, useId, useRef, useState } from "react"
import { Check, GripVertical } from "lucide-react"
import { moveMany } from "@/lib/reorder"

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
  /**
   * Adds a pick circle beside each handle, so several rows can be moved in one drag. Worth turning
   * on for a list long enough that moving rows one at a time is work; on a short fixed list it is
   * a circle per row that nobody needs.
   */
  multiSelect?: boolean
  // What the hint above the list calls the rows ("tasks", "people")
  itemNoun?: string
  /**
   * The picked rows, when the page wants to own them. Left out, the list keeps its own. Given, the
   * page decides what is picked, which is how one set of circles can mean more than "move these":
   * a page that also deletes ticked rows drives that from the same picking rather than adding a
   * second control to every row.
   */
  picked?: ReadonlySet<string>
  onPickedChange?: (picked: ReadonlySet<string>) => void
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

/**
 * A list whose rows can be moved up and down by dragging their handle: with a mouse, a finger or a
 * pen (pointer events, so it works on phones), with the page scrolling itself near the edges, and
 * the other rows sliding out of the way. The handle also answers the arrow keys, one place at a
 * time, and every move is announced. No drag library; nothing else in the row starts a drag.
 */
export function SortableList<T>({
  items,
  getId,
  getLabel,
  onReorder,
  renderItem,
  label,
  className = "",
  disabled = false,
  multiSelect = false,
  itemNoun = "rows",
  picked: pickedFromPage,
  onPickedChange,
}: SortableListProps<T>) {
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
  // The rows picked to move together, and the last one picked, which a Shift click reaches back to
  const [ownSelected, setOwnSelected] = useState<ReadonlySet<string>>(new Set())
  const selected = pickedFromPage ?? ownSelected
  const lastPicked = useRef<string | null>(null)
  // A row that has gone simply stops counting as picked, worked out as the list renders. The ids
  // go into a set first, because a team of 500 would otherwise be scanned once per picked row
  const onList = new Set(ids)
  const picked = new Set([...selected].filter((id) => onList.has(id)))
  // The page is told whichever way round it is, so it can act on the same picking
  const applyPicked = (next: ReadonlySet<string>) => {
    if (pickedFromPage === undefined) setOwnSelected(next)
    onPickedChange?.(next)
  }
  const isGroupDrag = drag !== null && picked.size > 1 && picked.has(drag.id)

  const clearPicked = () => {
    applyPicked(new Set())
    lastPicked.current = null
  }

  const pick = (id: string, isRange: boolean) => {
    // Both ends of the range are read before anything is set: a state updater runs after this
    // handler has returned, by which time `lastPicked` would already be the row just clicked
    const from = lastPicked.current ? ids.indexOf(lastPicked.current) : -1
    const to = ids.indexOf(id)
    const next = new Set(picked)
    if (isRange && from >= 0 && to >= 0) {
      for (const between of ids.slice(Math.min(from, to), Math.max(from, to) + 1)) next.add(between)
    } else if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    applyPicked(next)
    lastPicked.current = id
  }

  // What is about to move: every picked row when the dragged one is picked, otherwise just that row
  const movingWith = (id: string) => (picked.size > 1 && picked.has(id) ? picked : new Set([id]))
  const describeMoved = (item: T, moving: ReadonlySet<string>) =>
    moving.size > 1 ? `${moving.size} picked ${itemNoun}` : `"${getLabel(item)}"`

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
    // Dragging a row that was not picked moves that one, and the picking goes with it
    if (picked.size > 0 && !picked.has(id)) clearPicked()
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
      const moving = movingWith(current.id)
      onReorder(moveMany(ids, moving, current.from, current.over))
      setAnnouncement(`Moved ${describeMoved(items[current.from], moving)} to position ${current.over + 1} of ${ids.length}.`)
      // What has just landed where it was asked to go is no longer waiting to be moved
      if (moving.size > 1) clearPicked()
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
    const moving = movingWith(ids[index])
    onReorder(moveMany(ids, moving, index, to))
    setAnnouncement(`Moved ${describeMoved(item, moving)} to position ${to + 1} of ${ids.length}.`)
  }

  const offsetOf = (index: number) => {
    if (!drag || index === drag.from) return 0
    if (drag.from < drag.over && index > drag.from && index <= drag.over) return -drag.step
    if (drag.over < drag.from && index >= drag.over && index < drag.from) return drag.step
    return 0
  }

  return (
    <>
      {multiSelect && !disabled && items.length > 1 && (
        <p className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-outline">
          <span>Drag the handle to move one. To move several, click their circles, then drag one of them.</span>
          {picked.size > 0 && (
            <span role="status" className="flex shrink-0 items-center gap-2 font-semibold text-primary">
              {picked.size} picked
              <button type="button" onClick={clearPicked} className="underline hover:no-underline">
                Clear
              </button>
            </span>
          )}
        </p>
      )}
      {/* Nothing in the list gets selected as text while a row is dragged across it */}
      <ul className={`${className} ${drag ? "select-none" : ""}`} aria-label={label}>
        {items.map((item, index) => {
          const id = getId(item)
          const isDragging = drag?.id === id
          const isPicked = picked.has(id)
          // A picked row that is not the one under the pointer is coming along, so it says so
          const isPassenger = isGroupDrag && isPicked && !isDragging
          const circle = multiSelect && (
            <button
              type="button"
              disabled={disabled}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => pick(id, event.shiftKey)}
              aria-pressed={isPicked}
              aria-label={`Pick "${getLabel(item)}" to move it with other ${itemNoun}`}
              title={`Pick this, then drag any picked one to move them together`}
              className={`flex h-5 w-5 shrink-0 items-center justify-center self-center rounded-full border-2 transition-colors disabled:opacity-40 ${
                isPicked ? "border-primary bg-primary text-white" : "border-outline-variant text-transparent hover:border-primary/60"
              }`}
            >
              <Check size={12} aria-hidden="true" />
            </button>
          )
          const grip = (
            <button
              type="button"
              data-sortable-handle
              disabled={disabled}
              onPointerDown={(event) => start(event, id)}
              onPointerMove={(event) => measure.current?.pointerId === event.pointerId && update(event.clientY)}
              onPointerUp={(event) => measure.current?.pointerId === event.pointerId && finish(true)}
              onPointerCancel={() => finish(false)}
              onKeyDown={(event) => onKey(event, item, index)}
              aria-label={isPicked && picked.size > 1 ? `Move the ${picked.size} picked ${itemNoun}, starting with "${getLabel(item)}"` : `Move "${getLabel(item)}"`}
              aria-describedby={hintId}
              className={`flex h-8 w-7 shrink-0 touch-none items-center justify-center rounded-md text-outline transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-default disabled:opacity-40 ${
                isDragging ? "cursor-grabbing" : "cursor-grab"
              }`}
            >
              <GripVertical size={16} aria-hidden="true" />
            </button>
          )
          const handle = multiSelect ? (
            <span className="flex shrink-0 items-center gap-1">
              {circle}
              {grip}
            </span>
          ) : (
            grip
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
              className={`${isDragging ? "rounded-xl shadow-xl ring-2 ring-primary/30" : ""} ${isPassenger ? "opacity-40" : ""}`}
            >
              {renderItem(item, handle, isDragging)}
              {isDragging && isGroupDrag && (
                <span className="pointer-events-none absolute -right-2 -top-2 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-white shadow-lg">
                  +{picked.size - 1} more
                </span>
              )}
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
