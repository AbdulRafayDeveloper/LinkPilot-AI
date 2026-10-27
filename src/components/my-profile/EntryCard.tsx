"use client"

import React, { useState } from "react"
import { AlertTriangle, Clock3, ExternalLink, Pencil, SearchCheck, Trash2 } from "lucide-react"
import { entryDates, entrySubtitle, entryTitle, type ProfilePair } from "@/lib/profileSections"
import type { ProfileField, ProfileSection } from "@/constants/profileSections"
import type { ProfileEntry } from "@/types/myProfile"

const headingClass = "text-[11px] font-bold uppercase tracking-wider text-outline"

/** Whether this entry can be found yet, in words as well as colour. */
const SearchMark: React.FC<{ entry: ProfileEntry }> = ({ entry }) => {
  if (entry.searchStatus === "ready") {
    return (
      <span title="Saved for search" className="inline-flex items-center gap-1 rounded-full bg-success-container px-2 py-0.5 text-[11px] font-semibold text-on-success-container">
        <SearchCheck size={12} aria-hidden="true" />
        Searchable
      </span>
    )
  }
  if (entry.searchStatus === "failed") {
    return (
      <span title={entry.searchError ?? undefined} className="inline-flex items-center gap-1 rounded-full bg-error-container px-2 py-0.5 text-[11px] font-semibold text-on-error-container">
        <AlertTriangle size={12} aria-hidden="true" />
        Not searchable yet
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary-fixed px-2 py-0.5 text-[11px] font-semibold text-on-secondary-fixed-variant">
      <Clock3 size={12} aria-hidden="true" />
      Waiting for search
    </span>
  )
}

/** One field's value on the card, drawn for what it is; nothing for a field left empty. */
const FieldValueView: React.FC<{ field: ProfileField; value: unknown }> = ({ field, value }) => {
  if (field.kind === "lines" || field.kind === "chips") {
    const items = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
    if (items.length === 0) return null
    return field.kind === "chips" ? (
      <ul className="flex flex-wrap gap-1.5" aria-label={field.label}>
        {items.map((item) => (
          <li key={item} className="rounded-full bg-primary-fixed px-2.5 py-1 text-[12px] font-semibold text-on-primary-fixed-variant">
            {item}
          </li>
        ))}
      </ul>
    ) : (
      <div className="flex flex-col gap-1">
        <p className={headingClass}>{field.label}</p>
        <ul className="flex list-disc flex-col gap-0.5 pl-5 text-[13px] text-on-surface [overflow-wrap:anywhere]">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    )
  }
  if (field.kind === "pairs") {
    const pairs = Array.isArray(value) ? (value as ProfilePair[]).filter((pair) => pair?.first && pair?.second) : []
    if (pairs.length === 0) return null
    return (
      <div className="flex flex-col gap-1.5">
        <p className={headingClass}>{field.label}</p>
        <ul className="flex flex-col gap-1.5">
          {pairs.map((pair) => (
            <li key={`${pair.first}-${pair.second}`} className="rounded-xl bg-surface-container-low px-3 py-2 text-[13px] text-on-surface [overflow-wrap:anywhere]">
              <span className="font-semibold">{pair.first}</span>
              <span className="text-on-surface-variant"> → {pair.second}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }
  const text = typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : ""
  if (!text) return null
  if (field.kind === "url") {
    return (
      <a href={text} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit min-w-0 items-center gap-1 text-[13px] font-semibold text-primary hover:underline [overflow-wrap:anywhere]">
        <ExternalLink size={13} className="shrink-0" aria-hidden="true" />
        {field.label}
      </a>
    )
  }
  if (field.kind === "longText") {
    return (
      <div className="flex flex-col gap-1">
        <p className={headingClass}>{field.label}</p>
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-on-surface-variant [overflow-wrap:anywhere]">{text}</p>
      </div>
    )
  }
  return (
    <p className="text-[13px] text-on-surface [overflow-wrap:anywhere]">
      <span className="font-semibold text-on-surface-variant">{field.label}: </span>
      {text}
    </p>
  )
}

interface EntryCardProps {
  section: ProfileSection
  entry: ProfileEntry
  // The drag handle the list places on the card
  handle: React.ReactNode
  onEdit: () => void
  onRemove: () => void
  isBusy: boolean
}

/** One entry on its card: its name, what describes it, its dates, every field it holds, and whether it is searchable. */
export const EntryCard: React.FC<EntryCardProps> = ({ section, entry, handle, onEdit, onRemove, isBusy }) => {
  const [isConfirming, setIsConfirming] = useState(false)
  const subtitle = entrySubtitle(section, entry.fields)
  const dates = entryDates(section, entry.fields)
  const shown = new Set([section.titleField, ...section.subtitleFields, ...(section.dates ?? [])])
  return (
    <article aria-labelledby={`entry-${entry.id}`} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start gap-2">
        <span className="shrink-0">{handle}</span>
        <div className="min-w-0 flex-1">
          <h3 id={`entry-${entry.id}`} className="text-[16px] font-bold text-on-surface [overflow-wrap:anywhere]">
            {entryTitle(section, entry.fields)}
          </h3>
          {subtitle && <p className="text-[13px] text-on-surface-variant [overflow-wrap:anywhere]">{subtitle}</p>}
          {dates && <p className="text-[12px] font-semibold text-outline">{dates}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1 max-sm:w-full">
          <SearchMark entry={entry} />
          <button type="button" onClick={onEdit} disabled={isBusy} className="inline-flex min-h-6 items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-primary disabled:opacity-50">
            <Pencil size={13} aria-hidden="true" />
            Edit
          </button>
          {/* Removing asks once more on the button itself, so one slip of the mouse never loses an entry */}
          <button
            type="button"
            onClick={() => (isConfirming ? onRemove() : setIsConfirming(true))}
            onBlur={() => setIsConfirming(false)}
            disabled={isBusy}
            className={`inline-flex min-h-6 items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12px] font-semibold disabled:opacity-50 ${
              isConfirming ? "bg-error text-white" : "text-on-surface-variant hover:bg-error-container hover:text-error"
            }`}
          >
            <Trash2 size={13} aria-hidden="true" />
            {isConfirming ? `Delete this ${section.noun}?` : "Delete"}
          </button>
        </div>
      </div>
      {entry.searchStatus === "failed" && entry.searchError && <p className="rounded-xl bg-error-container/60 px-3 py-2 text-[12px] text-on-error-container">{entry.searchError}</p>}
      <div className="flex flex-col gap-3">
        {section.fields
          .filter((field) => !shown.has(field.key) && field.kind !== "toggle")
          .map((field) => (
            <FieldValueView key={field.key} field={field} value={entry.fields[field.key]} />
          ))}
      </div>
    </article>
  )
}
