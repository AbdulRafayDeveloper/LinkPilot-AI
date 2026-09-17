"use client"

import React, { useState } from "react"
import { CheckCircle2, ChevronDown, Circle, History, Loader2 } from "lucide-react"
import type { PlanHistoryDay, PlanHistoryPage, PlanItem } from "@/types/employees"
import { TaskReason } from "./TaskReason"

/** Ticks or unticks one task on a day gone by. Given one, the history ticks; without it, it reads. */
export type HistoryTick = (day: PlanHistoryDay, item: PlanItem, done: boolean) => Promise<void>

/** Writes why a task on a day gone by wasn't finished. Only the employee's own link passes one. */
export type HistoryReason = (day: PlanHistoryDay, item: PlanItem, reason: string) => Promise<void>

export const dayHeading = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })

export const tickTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })

const tickedOn = (iso: string, day: string) => {
  // A task ticked on a later day than it was planned for says which day
  const localDay = new Date(iso).toLocaleDateString("en-CA")
  return localDay === day ? tickTime(iso) : `${new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" })}, ${tickTime(iso)}`
}

const HistoryDay: React.FC<{ day: PlanHistoryDay; onTick?: HistoryTick; onReason?: HistoryReason }> = ({ day, onTick, onReason }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const total = day.items.length

  const tick = async (item: PlanItem, done: boolean) => {
    if (!onTick) return
    setSavingId(item.id)
    try {
      await onTick(day, item, done)
    } finally {
      setSavingId(null)
    }
  }
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
            <li key={item.id} className="py-1 text-[13px]">
              <div className="flex items-start gap-2">
              {onTick ? (
                // A day gone by stays tickable: a task finished late is ticked off where it belongs
                <input
                  type="checkbox"
                  checked={item.done}
                  disabled={savingId === item.id}
                  onChange={(event) => void tick(item, event.target.checked)}
                  aria-label={`Mark "${item.text}" as ${item.done ? "not done" : "done"} on ${dayHeading(day.date)}`}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
              ) : item.done ? (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" aria-label="Done" />
              ) : (
                <Circle size={16} className="mt-0.5 shrink-0 text-outline" aria-label="Not done" />
              )}
              <span className={`min-w-0 flex-1 break-words ${item.done ? "text-on-surface" : "text-on-surface-variant"}`}>{item.text}</span>
                {savingId === item.id ? (
                  <Loader2 size={13} className="mt-0.5 shrink-0 animate-spin text-primary" aria-hidden="true" />
                ) : (
                  item.completedAt && <span className="shrink-0 whitespace-nowrap text-[11px] text-outline">Done {tickedOn(item.completedAt, day.date)}</span>
                )}
              </div>
              {/* Why it wasn't finished: written from the employee's own link, read everywhere else */}
              <div className="pl-6">
                <TaskReason
                  reason={item.reason}
                  taskText={item.text}
                  isDone={item.done}
                  onSave={onReason ? (reason) => onReason(day, item, reason) : undefined}
                />
              </div>
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
  // Given, every day in the history can still be ticked; without it the history only reads
  onTick?: HistoryTick
  // Given, a reason can be written on any day in the history; the manager's page passes none
  onReason?: HistoryReason
}

/**
 * Past days, newest first: how much of each day's plan was finished, and when each task was ticked
 * off. Shared by the manager's page and the employee's own link, so both read the same record. A day
 * here is never closed for ticking: work finished after midnight, or after the day was handed in,
 * is ticked off on the day it belongs to.
 */
export const PlanHistory: React.FC<PlanHistoryProps> = ({ history, error, isLoadingMore, onLoadMore, onTick, onReason }) => (
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
            <HistoryDay key={day.date} day={day} onTick={onTick} onReason={onReason} />
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

/** Puts a day that was just ticked back where it was in the history. */
export const replaceHistoryDay = (current: PlanHistoryPage | null, day: PlanHistoryDay): PlanHistoryPage | null =>
  current && { ...current, days: current.days.map((entry) => (entry.date === day.date ? day : entry)) }
