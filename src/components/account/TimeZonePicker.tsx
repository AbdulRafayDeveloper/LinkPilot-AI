"use client"

import React, { useEffect, useId, useMemo, useRef, useState } from "react"
import { Check, ChevronsUpDown, Globe2, Laptop, Search } from "lucide-react"
import { matchesWords } from "@/lib/nameSearch"
import { offsetLabel, timeZoneOptions, zoneOffsetMinutes, type TimeZoneOption } from "@/lib/timeZone"
import { ACCOUNT_MESSAGES } from "@/constants/account"

/**
 * Choosing a timezone out of the four hundred or so a browser knows: one field that opens a search
 * box over the list, narrowing as you type a city, a region or an offset ("Karachi", "Europe",
 * "GMT+5"). The arrow keys move through what is left, Enter chooses, Escape closes, and a click
 * outside closes it too. The first choice is always "this browser's zone", which is what an account
 * that has not chosen follows.
 */

interface TimeZonePickerProps {
  // The chosen zone, or null to follow the browser
  value: string | null
  browserZone: string
  onChange: (zone: string | null) => void
  disabled?: boolean
}

type Entry = { kind: "browser" } | { kind: "zone"; option: TimeZoneOption }

const keyOf = (entry: Entry) => (entry.kind === "browser" ? "browser" : entry.option.zone)

export const TimeZonePicker: React.FC<TimeZonePickerProps> = ({ value, browserZone, onChange, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()

  // Worked out once: the offsets are read for now, which is what a person choosing a zone cares about
  const options = useMemo(() => timeZoneOptions(), [])
  const browserOffset = useMemo(() => offsetLabel(zoneOffsetMinutes(browserZone)), [browserZone])

  const entries = useMemo<Entry[]>(() => {
    const zones = options.filter((option) => matchesWords(option.search, query)).map((option): Entry => ({ kind: "zone", option }))
    const showBrowser = !query.trim() || matchesWords(`browser this device ${browserZone} ${browserOffset}`.toLowerCase(), query)
    return showBrowser ? [{ kind: "browser" }, ...zones] : zones
  }, [options, query, browserZone, browserOffset])

  const selected = value ? options.find((option) => option.zone === value) : null

  // A click anywhere outside closes it, the way any dropdown does
  useEffect(() => {
    if (!isOpen) return
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [isOpen])

  // The option the arrow keys are on stays in view, by scrolling the list alone and never the page
  const keepInView = (index: number) => {
    const list = listRef.current
    const item = list?.children[index] as HTMLElement | undefined
    if (!list || !item) return
    if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop
    else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight
  }

  // Where a zone sits in the unfiltered list (the browser's choice first)
  const entriesIndexOf = (zone: string) => Math.max(0, options.findIndex((option) => option.zone === zone) + 1)

  const open = () => {
    if (disabled) return
    setQuery("")
    // Opens on what is chosen now, so the list starts where the person already is
    const current = value ? entriesIndexOf(value) : 0
    setActive(current)
    setIsOpen(true)
    requestAnimationFrame(() => keepInView(current))
  }

  const choose = (entry: Entry) => {
    setIsOpen(false)
    onChange(entry.kind === "browser" ? null : entry.option.zone)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault()
      setIsOpen(false)
      return
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      const next = Math.min(Math.max(0, active + (event.key === "ArrowDown" ? 1 : -1)), entries.length - 1)
      setActive(next)
      keepInView(next)
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      const entry = entries[active]
      if (entry) choose(entry)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-haspopup="listbox"
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        disabled={disabled}
        className="flex w-full items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest px-3.5 py-2.5 text-left transition-colors hover:border-primary/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {selected ? <Globe2 size={17} className="shrink-0 text-primary" aria-hidden="true" /> : <Laptop size={17} className="shrink-0 text-primary" aria-hidden="true" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-on-surface">{selected ? selected.city : "Browser time zone"}</span>
          <span className="block truncate text-[12px] text-on-surface-variant">{selected ? selected.zone : browserZone}</span>
        </span>
        <span className="shrink-0 rounded-md bg-surface-container px-2 py-0.5 font-code text-[11px] font-semibold text-on-surface-variant">
          {selected ? selected.offset : browserOffset}
        </span>
        <ChevronsUpDown size={16} className="shrink-0 text-outline" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-xl">
          <label className="flex items-center gap-2 border-b border-outline-variant/70 px-3.5 py-2.5">
            <Search size={16} className="shrink-0 text-outline" aria-hidden="true" />
            <span className="sr-only">{ACCOUNT_MESSAGES.timeZoneSearch}</span>
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActive(0)
                if (listRef.current) listRef.current.scrollTop = 0
              }}
              onKeyDown={onKeyDown}
              placeholder={ACCOUNT_MESSAGES.timeZoneSearch}
              aria-controls={listId}
              aria-activedescendant={entries[active] ? `${listId}-${keyOf(entries[active])}` : undefined}
              className="w-full bg-transparent text-[14px] text-on-surface placeholder:text-outline focus:outline-none"
            />
          </label>
          {entries.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-on-surface-variant">{ACCOUNT_MESSAGES.timeZoneNoMatch}</p>
          ) : (
            <ul ref={listRef} id={listId} role="listbox" aria-label={ACCOUNT_MESSAGES.timeZoneTitle} className="custom-scrollbar relative max-h-72 overflow-y-auto py-1.5">
              {entries.map((entry, index) => {
                const isChosen = entry.kind === "browser" ? value === null : entry.option.zone === value
                const isActive = index === active
                return (
                  <li
                    key={keyOf(entry)}
                    id={`${listId}-${keyOf(entry)}`}
                    role="option"
                    aria-selected={isChosen}
                    // Mouse down, not click, so choosing never loses to the search box losing focus
                    onMouseDown={(event) => {
                      event.preventDefault()
                      choose(entry)
                    }}
                    onMouseEnter={() => setActive(index)}
                    className={`mx-1.5 flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 ${isActive ? "bg-primary/10" : ""} ${
                      entry.kind === "browser" ? "mb-1 border-b border-outline-variant/60 pb-2.5" : ""
                    }`}
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center text-primary">{isChosen && <Check size={15} aria-hidden="true" />}</span>
                    {entry.kind === "browser" ? (
                      <>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-on-surface">{ACCOUNT_MESSAGES.timeZoneBrowser(browserZone)}</span>
                          <span className="block truncate text-[11px] text-on-surface-variant">Changes with the computer&apos;s own clock</span>
                        </span>
                        <span className="shrink-0 font-code text-[11px] font-semibold text-outline">{browserOffset}</span>
                      </>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-on-surface">{entry.option.city}</span>
                          <span className="block truncate text-[11px] text-on-surface-variant">{entry.option.zone}</span>
                        </span>
                        <span className="shrink-0 font-code text-[11px] font-semibold text-outline">{entry.option.offset}</span>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
