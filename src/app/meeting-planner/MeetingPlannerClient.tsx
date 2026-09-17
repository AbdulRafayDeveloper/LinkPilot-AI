"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarPlus, FilePenLine, Loader2, Sparkles } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { TodayMeetings } from "@/components/meeting-planner/TodayMeetings"
import { MonthCalendar } from "@/components/meeting-planner/MonthCalendar"
import { DayMeetingsPanel } from "@/components/meeting-planner/DayMeetingsPanel"
import {
  MeetingFormModal,
  emptyMeetingForm,
  type MeetingFormValues,
} from "@/components/meeting-planner/MeetingFormModal"
import { MeetingPlannerPromptsModal } from "@/components/meeting-planner/MeetingPlannerPromptsModal"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { requestApi } from "@/lib/apiClient"
import { monthOf, monthsBetween, nextHalfHour, shiftMonth, todayIso } from "@/lib/meetingDates"
import {
  CALENDAR_MONTH_RANGE,
  MEETING_PLANNER_ENDPOINT,
  MEETING_PLANNER_MESSAGES,
} from "@/constants/meetingPlanner"
import type { MeetingPlan, MeetingPlanDetail, MeetingPlannerPage } from "@/types/meetingPlanner"

export default function MeetingPlannerClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  // The browser's own day, so today's meetings are today's wherever the server runs
  const [today, setToday] = useState("")
  const [month, setMonth] = useState("")
  const [selectedDate, setSelectedDate] = useState("")
  const [page, setPage] = useState<MeetingPlannerPage | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [savingIds, setSavingIds] = useState<ReadonlySet<string>>(new Set())
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formDate, setFormDate] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [preparingName, setPreparingName] = useState<string | null>(null)
  const [isPromptsOpen, setIsPromptsOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()

  // The day is read on arrival and again when the tab comes back, so a page left open overnight
  // moves on to the new day
  useEffect(() => {
    const readToday = () => {
      const current = todayIso()
      setToday((previous) => (previous === current ? previous : current))
      setMonth((previous) => previous || monthOf(current))
      setSelectedDate((previous) => previous || current)
    }
    readToday()
    const onVisible = () => {
      if (document.visibilityState === "visible") readToday()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", readToday)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", readToday)
    }
  }, [])

  useEffect(() => {
    if (!today || !month) return
    const controller = new AbortController()
    requestApi<MeetingPlannerPage>(`${MEETING_PLANNER_ENDPOINT}?month=${month}&today=${today}`, {
      signal: controller.signal,
    })
      .then(({ data }) => {
        setPage(data)
        setLoadError(null)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(error instanceof Error ? error.message : MEETING_PLANNER_MESSAGES.loadFailed)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [today, month, loadAttempt])

  const reload = useCallback(() => {
    setIsLoading(true)
    setLoadAttempt((attempt) => attempt + 1)
  }, [])

  const changeMonth = (move: "previous" | "next" | "today") => {
    setIsLoading(true)
    if (move === "today") {
      setMonth(monthOf(today))
      setSelectedDate(today)
      return
    }
    setMonth((current) => shiftMonth(current, move === "previous" ? -1 : 1))
  }

  const dayMeetings = useMemo(
    () => (page?.meetings ?? []).filter((meeting) => meeting.meetingDate === selectedDate),
    [page, selectedDate]
  )
  const monthsFromToday = today && month ? monthsBetween(monthOf(today), month) : 0

  const openForm = (date: string) => {
    setFormDate(date || today)
    setFormError(null)
    setIsFormOpen(true)
  }

  // Preparation runs in its own request after the meeting is saved, so a slow or failing model
  // can never cost the meeting
  const runPreparation = async (meeting: MeetingPlanDetail) => {
    setPreparingName(meeting.name)
    try {
      await requestApi<MeetingPlanDetail>(`${MEETING_PLANNER_ENDPOINT}/${meeting.id}/prepare`, { method: "POST" })
      setNotice(`Preparation ready for "${meeting.name}".`)
    } catch (error: unknown) {
      setNotice(
        `${meeting.name} is saved, but the preparation didn't finish${
          error instanceof Error && error.message ? `: ${error.message}` : "."
        } Open the meeting to try again.`
      )
    } finally {
      setPreparingName(null)
      reload()
    }
  }

  const createMeeting = async (values: MeetingFormValues) => {
    if (isSaving) return
    setIsSaving(true)
    setFormError(null)
    try {
      const { data } = await requestApi<MeetingPlanDetail>(MEETING_PLANNER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          meetingDate: values.meetingDate,
          meetingTime: values.meetingTime,
          personName: values.personName || null,
          prepEnabled: values.prepEnabled,
          profileInfo: values.profileInfo || null,
          conversationHistory: values.conversationHistory || null,
          additionalInfo: values.additionalInfo || null,
        }),
      })
      setIsFormOpen(false)
      setSelectedDate(data.meetingDate)
      if (monthOf(data.meetingDate) !== month) setMonth(monthOf(data.meetingDate))
      setNotice(data.prepEnabled ? `"${data.name}" saved. Writing the preparation...` : MEETING_PLANNER_MESSAGES.created)
      reload()
      if (data.prepEnabled) void runPreparation(data)
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : MEETING_PLANNER_MESSAGES.saveFailed)
    } finally {
      setIsSaving(false)
    }
  }

  // The status changes on screen at once and is written in the background
  const toggleStatus = async (meeting: MeetingPlan) => {
    if (savingIds.has(meeting.id)) return
    const status = meeting.status === "completed" ? "pending" : "completed"
    setSavingIds((current) => new Set(current).add(meeting.id))
    const apply = (updated: MeetingPlan) =>
      setPage((current) =>
        current
          ? {
              ...current,
              meetings: current.meetings.map((entry) => (entry.id === updated.id ? updated : entry)),
              today: current.today.map((entry) => (entry.id === updated.id ? updated : entry)),
              pendingToday: current.today.filter((entry) =>
                entry.id === updated.id ? updated.status === "pending" : entry.status === "pending"
              ).length,
            }
          : current
      )
    apply({ ...meeting, status })
    try {
      const { data } = await requestApi<MeetingPlanDetail>(`${MEETING_PLANNER_ENDPOINT}/${meeting.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      apply(data)
    } catch (error: unknown) {
      apply(meeting)
      setNotice(error instanceof Error ? error.message : MEETING_PLANNER_MESSAGES.updateFailed)
    } finally {
      setSavingIds((current) => {
        const next = new Set(current)
        next.delete(meeting.id)
        return next
      })
    }
  }

  return (
    <div className="font-body-md text-body-md min-h-screen bg-background text-on-surface flex overflow-hidden h-screen">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        <Header
          onOpenSidebar={() => setIsSidebarOpen(true)}
          isSidebarCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapsed}
        />

        <main className="flex-1 overflow-y-auto bg-background overflow-x-hidden">
          <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-5">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
                  <CalendarPlus size={24} className="text-primary shrink-0" aria-hidden="true" />
                  Meeting Scheduler & Planner
                </h1>
                <p className="text-sm text-on-surface-variant mt-1">
                  Put a meeting in the calendar, and have it read the person and plan the conversation before you join.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPromptsOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                >
                  <FilePenLine size={16} aria-hidden="true" />
                  Update Prompt
                </button>
                <button
                  type="button"
                  onClick={() => openForm(selectedDate)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-on-primary-fixed-variant sm:flex-none"
                >
                  <CalendarPlus size={16} aria-hidden="true" />
                  New meeting
                </button>
              </div>
            </div>

            <div className="min-h-[20px] shrink-0 text-[12px]" aria-live="polite">
              {preparingName && (
                <p className="flex items-center gap-2 text-primary">
                  <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                  Preparing &quot;{preparingName}&quot;. You can keep working; it is saved when it finishes.
                </p>
              )}
              {!preparingName && notice && <p className="text-on-surface-variant">{notice}</p>}
              {loadError && (
                <p role="alert" className="flex flex-wrap items-center gap-2 text-error">
                  {loadError}
                  <button type="button" onClick={reload} className="font-semibold underline hover:no-underline">
                    Try again
                  </button>
                </p>
              )}
            </div>

            <TodayMeetings
              meetings={page?.today ?? []}
              todayDate={page?.todayDate ?? today}
              pendingToday={page?.pendingToday ?? 0}
              savingIds={savingIds}
              onToggleStatus={toggleStatus}
            />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              {month && (
                <MonthCalendar
                  month={month}
                  meetings={page?.meetings ?? []}
                  today={today}
                  selectedDate={selectedDate}
                  isLoading={isLoading}
                  canGoBack={monthsFromToday > -CALENDAR_MONTH_RANGE}
                  canGoForward={monthsFromToday < CALENDAR_MONTH_RANGE}
                  onMonthChange={changeMonth}
                  onSelectDay={setSelectedDate}
                />
              )}
              <DayMeetingsPanel
                date={selectedDate}
                meetings={dayMeetings}
                savingIds={savingIds}
                onToggleStatus={toggleStatus}
                onAddMeeting={openForm}
              />
            </div>

            <p className="flex items-center gap-2 text-[11px] text-outline">
              <Sparkles size={12} aria-hidden="true" />
              Preparation reads what you paste plus your own About Me and Rafay Profile Info, and is saved with the meeting.
            </p>
          </div>
        </main>
      </div>

      {isFormOpen && (
        <MeetingFormModal
          title="New meeting"
          initial={emptyMeetingForm(formDate || today, nextHalfHour())}
          isSaving={isSaving}
          error={formError}
          onSubmit={createMeeting}
          onClose={() => {
            if (isSaving) return
            setIsFormOpen(false)
            setFormError(null)
          }}
        />
      )}
      {isPromptsOpen && <MeetingPlannerPromptsModal onClose={() => setIsPromptsOpen(false)} />}
    </div>
  )
}
