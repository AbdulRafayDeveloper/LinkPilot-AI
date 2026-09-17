"use client"

import React, { useState } from "react"
import { CheckCircle2, ChevronDown, Circle, History, Loader2 } from "lucide-react"
import type { PlanHistoryDay, PlanHistoryPage } from "@/types/employees"

export const dayHeading = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })

export const tickTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })

const tickedOn = (iso: string, day: string) => {
  // A task ticked on a later day than it was planned for says which day
  const localDay = new Date(iso).toLocaleDateString("en-CA")
  return localDay === day ? tickTime(iso) : `${new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" })}, ${tickTime(iso)}`
}

const HistoryDay: React.FC<{ day: PlanHistoryDay }> = ({ day }) => {
  const [isOpen, setIsOpen] = useState(false)
  const total = day.items.length
  const complete = day.doneCount === total
  return (
    <li className="rounded-xl border border-outline-variant/80 bg-white">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-container-lowest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-on-surface">{dayHeading(day.date)}</span>
          <span className="mt-1 flex items-center gap-2">
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-container-high" aria-hidden="true">
              <span className={`block h-full rounded-full ${complete ? "bg-success" : "bg-primary"}`} style={{ width: `${Math.round((day.doneCount / total) * 100)}%` }} />
            </span>
            <span className={`text-[12px] font-semibold ${complete ? "text-on-success-container" : "text-on-surface-variant"}`}>
              {day.doneCount} of {total} done
            </span>
          </span>
        </span>
        <ChevronDown size={16} className={`shrink-0 text-outline transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {isOpen && (
        <ul className="flex flex-col gap-1 border-t border-outline-variant/70 px-3 py-2" aria-label={`Tasks on ${dayHeading(day.date)}`}>
          {day.items.map((item) => (
            <li key={item.id} className="flex items-start gap-2 py-1 text-[13px]">
              {item.done ? (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" aria-label="Done" />
              ) : (
                <Circle size={16} className="mt-0.5 shrink-0 text-outline" aria-label="Not done" />
              )}
              <span className={`min-w-0 flex-1 break-words ${item.done ? "text-on-surface" : "text-on-surface-variant"}`}>{item.text}</span>
              {item.completedAt && <span className="shrink-0 whitespace-nowrap text-[11px] text-outline">Done {tickedOn(item.completedAt, day.date)}</span>}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

interface PlanHistoryProps {
  history: PlanHistoryPage | null
  error: string | null
  isLoadingMore: boolean
  onLoadMore: () => void
}

/**
 * Past days, newest first: how much of each day's plan was finished, and when each task was ticked
 * off. Shared by the manager's page and the employee's own link, so both read the same record.
 */
export const PlanHistory: React.FC<PlanHistoryProps> = ({ history, error, isLoadingMore, onLoadMore }) => (
  <section aria-label="History" className="flex flex-col gap-3">
    <h3 className="flex items-center gap-2 text-[14px] font-bold text-on-surface">
      <History size={16} className="text-primary" aria-hidden="true" />
      History
    </h3>
    {error && (
      <p role="alert" className="rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
        {error}
      </p>
    )}
    {!history ? (
      !error && (
        <p role="status" className="flex items-center gap-2 text-[13px] text-on-surface-variant">
          <Loader2 size={14} className="animate-spin text-primary" aria-hidden="true" />
          Loading earlier days...
        </p>
      )
    ) : history.days.length === 0 ? (
      <p className="text-[13px] text-on-surface-variant">No earlier days with tasks yet.</p>
    ) : (
      <>
        <ul className="flex flex-col gap-2">
          {history.days.map((day) => (
            <HistoryDay key={day.date} day={day} />
          ))}
        </ul>
        {history.nextBefore && (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60"
          >
            {isLoadingMore && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
            Show older days
          </button>
        )}
      </>
    )}
  </section>
)

/** Appends the next page of history to what is on screen, never repeating a day. */
export const mergeHistory = (current: PlanHistoryPage | null, next: PlanHistoryPage): PlanHistoryPage => {
  if (!current) return next
  const seen = new Set(current.days.map((day) => day.date))
  return { days: [...current.days, ...next.days.filter((day) => !seen.has(day.date))], nextBefore: next.nextBefore }
}
