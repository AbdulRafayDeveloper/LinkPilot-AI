"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, CalendarDays, Link2, Loader2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { requestApi } from "@/lib/apiClient"
import { matchesWords } from "@/lib/nameSearch"
import { MEETING_PLAN_LINK_MESSAGES } from "@/constants/meetings"
import { MEETING_PLANNER_ENDPOINT } from "@/constants/meetingPlanner"
import { dayLabel, formatTime, monthOf, shiftMonth, todayIso } from "@/lib/meetingDates"
import type { MeetingPlan, MeetingPlannerPage } from "@/types/meetingPlanner"

interface LinkToPlanDialogProps {
  // How many records are being linked, for the title
  count: number
  isSaving: boolean
  error: string | null
  onSubmit: (planId: string) => void
  onClose: () => void
}

/**
 * Which meeting on the calendar these notes or recordings are of.
 *
 * The planned meetings are read from the planner itself, three months of them (last month, this
 * month and next), which is where a meeting that has just been held sits. They are listed with the
 * most recent first, because the record being linked is nearly always of a meeting that has just
 * happened, and the list is searched by typing when there are many.
 */
export const LinkToPlanDialog: React.FC<LinkToPlanDialogProps> = ({ count, isSaving, error, onSubmit, onClose }) => {
  const [plans, setPlans] = useState<MeetingPlan[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [chosen, setChosen] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    const today = todayIso()
    const months = [shiftMonth(monthOf(today), -1), monthOf(today), shiftMonth(monthOf(today), 1)]
    Promise.all(
      months.map((month) =>
        requestApi<MeetingPlannerPage>(`${MEETING_PLANNER_ENDPOINT}?month=${month}&today=${today}`, { signal: controller.signal })
      )
    )
      .then((answers) => {
        // One meeting may be read twice where the months overlap, so they are kept by id
        const byId = new Map<string, MeetingPlan>()
        for (const { data } of answers) for (const meeting of data.meetings) byId.set(meeting.id, meeting)
        setPlans(
          [...byId.values()].sort(
            (a, b) => b.meetingDate.localeCompare(a.meetingDate) || b.meetingTime.localeCompare(a.meetingTime)
          )
        )
        setLoadError(null)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(reason instanceof Error ? reason.message : MEETING_PLAN_LINK_MESSAGES.linkFailed)
      })
    return () => controller.abort()
  }, [])

  const offered = useMemo(
    () => (plans ?? []).filter((plan) => !search.trim() || matchesWords(`${plan.name} ${plan.personName ?? ""}`, search)),
    [plans, search]
  )

  return (
    <Modal
      title={MEETING_PLAN_LINK_MESSAGES.choose}
      description={`${count} ${count === 1 ? "record" : "records"} will point at it. ${MEETING_PLAN_LINK_MESSAGES.chooseHint}`}
      onClose={onClose}
      isCloseDisabled={isSaving}
      initialFocusRef={input}
      size="compact"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p role="alert" className="min-h-[20px] text-xs text-error">
            {error}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => chosen && onSubmit(chosen)}
              disabled={isSaving || !chosen}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Link2 size={15} aria-hidden="true" />}
              {MEETING_PLAN_LINK_MESSAGES.link}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <input
          ref={input}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={MEETING_PLAN_LINK_MESSAGES.search}
          aria-label={MEETING_PLAN_LINK_MESSAGES.search}
          className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[14px] text-on-surface placeholder:text-outline focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/25"
          disabled={isSaving}
        />

        {loadError && (
          <p role="alert" className="flex gap-2 rounded-xl bg-error-container px-3 py-2.5 text-[13px] text-error">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {loadError}
          </p>
        )}

        {plans === null && !loadError ? (
          <p role="status" className="flex items-center gap-2 py-6 text-[13px] text-on-surface-variant">
            <Loader2 size={16} className="animate-spin text-primary" aria-hidden="true" />
            Loading the calendar...
          </p>
        ) : offered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-outline-variant px-3 py-6 text-center text-[13px] text-outline">
            {search.trim() ? MEETING_PLAN_LINK_MESSAGES.noMatch : MEETING_PLAN_LINK_MESSAGES.noneToLink}
          </p>
        ) : (
          <ul className="custom-scrollbar flex max-h-72 flex-col gap-1 overflow-y-auto">
            {offered.map((plan) => {
              const isChosen = plan.id === chosen
              return (
                <li key={plan.id}>
                  <button
                    type="button"
                    onClick={() => setChosen(plan.id)}
                    aria-pressed={isChosen}
                    className={`flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left transition-colors ${
                      isChosen ? "bg-primary-container text-on-primary-container" : "text-on-surface hover:bg-surface-container-low"
                    }`}
                  >
                    <CalendarDays size={14} className="mt-0.5 shrink-0 text-outline" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{plan.name}</span>
                      <span className={`block text-[11px] ${isChosen ? "text-on-primary-container/80" : "text-outline"}`}>
                        {dayLabel(plan.meetingDate, { weekday: "short", month: "short" })} at {formatTime(plan.meetingTime)}
                        {plan.personName ? ` · ${plan.personName}` : ""}
                        {(plan.linkedCount ?? 0) > 0 ? ` · ${MEETING_PLAN_LINK_MESSAGES.notesOn(plan.linkedCount ?? 0)} already` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Modal>
  )
}
