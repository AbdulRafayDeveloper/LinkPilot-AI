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
  formValuesOf,
  recurrenceOf,
  updateScopeOf,
  type MeetingFormValues,
} from "@/components/meeting-planner/MeetingFormModal"
import { MoveMeetingModal } from "@/components/meeting-planner/MoveMeetingModal"
import { DeleteMeetingDialog } from "@/components/meeting-planner/DeleteMeetingDialog"
import { MeetingPlannerPromptsModal } from "@/components/meeting-planner/MeetingPlannerPromptsModal"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { requestApi } from "@/lib/apiClient"
import { monthOf, monthsBetween, nextHalfHour, shiftMonth, todayIso } from "@/lib/meetingDates"
import {
  CALENDAR_MONTH_RANGE,
  MEETING_PLANNER_ENDPOINT,
  MEETING_PLANNER_MESSAGES,
  type DeleteScopeId,
  type MeetingPlanStatusId,
  type UpdateScopeId,
} from "@/constants/meetingPlanner"
import type { MeetingPlan, MeetingPlanDetail, MeetingPlannerPage } from "@/types/meetingPlanner"
import { MeetingNotesModal } from "@/components/meeting-planner/MeetingNotesModal"
import { LinkedMeetingsDialog } from "@/components/meeting-planner/LinkedMeetingsDialog"

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
  /**
   * The meeting being edited from the calendar, read in full first: a list carries no preparation
   * inputs, and the form needs them, so it opens on what the meeting really holds. This is how the
   * attend link is added without leaving the page, which is what the owner asked for.
   */
  const [editing, setEditing] = useState<MeetingPlanDetail | null>(null)
  const [isOpeningEdit, setIsOpeningEdit] = useState<string | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  // One meeting being moved, or being deleted (alone or with its series), from the day list
  const [moving, setMoving] = useState<MeetingPlan | null>(null)
  const [isMoving, setIsMoving] = useState(false)
  const [moveError, setMoveError] = useState<string | null>(null)
  /**
   * The meeting whose notes are open. The lists carry only `hasNotes`, so the notes themselves are
   * read with the meeting when the panel opens and kept here while it is on screen.
   */
  const [notesFor, setNotesFor] = useState<MeetingPlan | null>(null)
  // The planned meeting whose records (notes, recordings) are being looked at
  const [linkedFor, setLinkedFor] = useState<MeetingPlan | null>(null)
  const [notesText, setNotesText] = useState("")
  const [isLoadingNotes, setIsLoadingNotes] = useState(false)
  const [deleting, setDeleting] = useState<MeetingPlan | null>(null)
  const [deletingScope, setDeletingScope] = useState<DeleteScopeId | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
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
      await requestApi<MeetingPlanDetail>(`${MEETING_PLANNER_ENDPOINT}/${meeting.id}/prepare`, { method: "POST" }, { retry: true })
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
          profileLink: values.profileLink || null,
          joinUrl: values.joinUrl || null,
          prepEnabled: values.prepEnabled,
          profileInfo: values.profileInfo || null,
          conversationHistory: values.conversationHistory || null,
          additionalInfo: values.additionalInfo || null,
          recurrence: recurrenceOf(values),
        }),
      }, { idempotent: true })
      setIsFormOpen(false)
      setSelectedDate(data.meetingDate)
      if (monthOf(data.meetingDate) !== month) setMonth(monthOf(data.meetingDate))
      const saved = data.seriesSize ? MEETING_PLANNER_MESSAGES.seriesCreated(data.seriesSize) : MEETING_PLANNER_MESSAGES.created
      setNotice(data.prepEnabled ? `"${data.name}" saved. Writing the preparation...` : saved)
      reload()
      if (data.prepEnabled) void runPreparation(data)
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : MEETING_PLANNER_MESSAGES.saveFailed)
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Opens a meeting's notes. A list never carries the notes themselves (they can be as long as any
   * other text box here), so the meeting is read first and the panel opens on what it holds.
   */
  const openNotes = async (meeting: MeetingPlan) => {
    setNotesFor(meeting)
    setNotesText("")
    if (!meeting.hasNotes) return
    setIsLoadingNotes(true)
    try {
      const { data } = await requestApi<MeetingPlanDetail>(`${MEETING_PLANNER_ENDPOINT}/${meeting.id}`)
      setNotesText(data.notes)
    } catch (error: unknown) {
      setNotesFor(null)
      setNotice(null)
      setLoadError(error instanceof Error ? error.message : MEETING_PLANNER_MESSAGES.loadFailed)
    } finally {
      setIsLoadingNotes(false)
    }
  }

  /** Opens the edit form on everything the meeting holds, read first so nothing is lost by editing. */
  const openEdit = async (meeting: MeetingPlan) => {
    if (isOpeningEdit) return
    setIsOpeningEdit(meeting.id)
    setEditError(null)
    try {
      const { data } = await requestApi<MeetingPlanDetail>(`${MEETING_PLANNER_ENDPOINT}/${meeting.id}`)
      setEditing(data)
    } catch (error: unknown) {
      setNotice(null)
      setLoadError(error instanceof Error ? error.message : MEETING_PLANNER_MESSAGES.loadFailed)
    } finally {
      setIsOpeningEdit(null)
    }
  }

  /**
   * Saves the edit. The scope is the form's own tick box: on a repeating meeting it offers to put
   * the change, the attend link included, on every later meeting of the series.
   */
  const saveEdit = async (values: MeetingFormValues) => {
    if (!editing || isSavingEdit) return
    setIsSavingEdit(true)
    setEditError(null)
    try {
      await requestApi<MeetingPlanDetail>(`${MEETING_PLANNER_ENDPOINT}/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          meetingDate: values.meetingDate,
          meetingTime: values.meetingTime,
          personName: values.personName || null,
          profileLink: values.profileLink || null,
          joinUrl: values.joinUrl || null,
          prepEnabled: values.prepEnabled,
          profileInfo: values.profileInfo || null,
          conversationHistory: values.conversationHistory || null,
          additionalInfo: values.additionalInfo || null,
          scope: updateScopeOf(values),
        }),
      })
      setEditing(null)
      setNotice(values.applyToSeries ? MEETING_PLANNER_MESSAGES.seriesLinkApplied : MEETING_PLANNER_MESSAGES.updated)
      reload()
    } catch (error: unknown) {
      setEditError(error instanceof Error ? error.message : MEETING_PLANNER_MESSAGES.updateFailed)
    } finally {
      setIsSavingEdit(false)
    }
  }

  /**
   * Moves a meeting to another day or time. With `scope: "series"` the new time becomes the series'
   * time: this meeting and every later one of it move, and a changed day moves them all by the same
   * number of days. "one" moves that occurrence alone, which is what it always did. The calendar is
   * read again afterwards, so a meeting moved into another month leaves this one.
   */
  const moveMeeting = async (meetingDate: string, meetingTime: string, scope: UpdateScopeId) => {
    if (!moving || isMoving) return
    setIsMoving(true)
    setMoveError(null)
    try {
      const { message } = await requestApi<MeetingPlanDetail>(`${MEETING_PLANNER_ENDPOINT}/${moving.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingDate, meetingTime, scope }),
      })
      setMoving(null)
      setNotice(scope === "series" ? message || MEETING_PLANNER_MESSAGES.seriesUpdated : MEETING_PLANNER_MESSAGES.moved)
      reload()
    } catch (error: unknown) {
      setMoveError(error instanceof Error ? error.message : MEETING_PLANNER_MESSAGES.updateFailed)
    } finally {
      setIsMoving(false)
    }
  }

  /** Deletes one meeting, or with `series` every meeting of its series, then reads the calendar again. */
  const deleteMeeting = async (scope: DeleteScopeId) => {
    if (!deleting || deletingScope) return
    setDeletingScope(scope)
    setDeleteError(null)
    try {
      const query = scope === "series" ? "?scope=series" : ""
      const { message } = await requestApi<{ deleted: boolean; count: number }>(`${MEETING_PLANNER_ENDPOINT}/${deleting.id}${query}`, {
        method: "DELETE",
      })
      setDeleting(null)
      setNotice(message || MEETING_PLANNER_MESSAGES.deleted)
      reload()
    } catch (error: unknown) {
      setDeleteError(error instanceof Error ? error.message : MEETING_PLANNER_MESSAGES.deleteFailed)
    } finally {
      setDeletingScope(null)
    }
  }

  // The status changes on screen at once and is written in the background
  const changeStatus = async (meeting: MeetingPlan, status: MeetingPlanStatusId) => {
    if (savingIds.has(meeting.id)) return
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
                  className="inline-flex flex-1 items-center justify-center whitespace-nowrap gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-on-primary-fixed-variant sm:flex-none"
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
              {/* Today's meetings sits beside the calendar rather than above it: on a short laptop
                  window the page is as tall as the calendar, and this is the column with room. */}
              <div className="flex flex-col gap-5 short:gap-3 min-w-0">
              <TodayMeetings
                meetings={page?.today ?? []}
                todayDate={page?.todayDate ?? today}
                pendingToday={page?.pendingToday ?? 0}
                savingIds={savingIds}
                onChangeStatus={changeStatus}
                onNotes={(meeting) => void openNotes(meeting)}
                onEditDetails={(meeting) => void openEdit(meeting)}
              />
              <DayMeetingsPanel
                date={selectedDate}
                meetings={dayMeetings}
                savingIds={savingIds}
                onChangeStatus={changeStatus}
                onNotes={(meeting) => void openNotes(meeting)}
                onLinked={setLinkedFor}
                onAddMeeting={openForm}
                onEdit={(meeting) => {
                  setMoveError(null)
                  setMoving(meeting)
                }}
                onEditDetails={(meeting) => void openEdit(meeting)}
                onDelete={(meeting) => {
                  setDeleteError(null)
                  setDeleting(meeting)
                }}
              />
              </div>
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
          allowRepeat
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
      {editing && (
        <MeetingFormModal
          key={editing.id}
          title="Edit meeting"
          initial={formValuesOf(editing)}
          existing={editing}
          isSaving={isSavingEdit}
          error={editError}
          onSubmit={saveEdit}
          onClose={() => {
            if (isSavingEdit) return
            setEditing(null)
            setEditError(null)
          }}
        />
      )}
      {isPromptsOpen && <MeetingPlannerPromptsModal onClose={() => setIsPromptsOpen(false)} />}
      {moving && (
        <MoveMeetingModal
          key={moving.id}
          meeting={moving}
          isSaving={isMoving}
          error={moveError}
          onSubmit={(meetingDate, meetingTime, scope) => void moveMeeting(meetingDate, meetingTime, scope)}
          onClose={() => setMoving(null)}
        />
      )}
      {/* The notes panel waits for the meeting to be read, so it never opens on an empty box that
          then fills in underneath the caret. */}
      {notesFor && !isLoadingNotes && (
        <MeetingNotesModal
          key={notesFor.id}
          meeting={notesFor}
          notes={notesText}
          onSaved={(meeting) => {
            // The lists only know whether there are notes, so the row follows the save at once
            setNotesFor((current) => (current ? { ...current, hasNotes: meeting.hasNotes, notesUpdatedAt: meeting.notesUpdatedAt } : current))
            setPage((current) =>
              current
                ? {
                    ...current,
                    meetings: current.meetings.map((entry) => (entry.id === meeting.id ? { ...entry, hasNotes: meeting.hasNotes, notesUpdatedAt: meeting.notesUpdatedAt } : entry)),
                    today: current.today.map((entry) => (entry.id === meeting.id ? { ...entry, hasNotes: meeting.hasNotes, notesUpdatedAt: meeting.notesUpdatedAt } : entry)),
                  }
                : current
            )
          }}
          onClose={() => setNotesFor(null)}
        />
      )}
      {linkedFor && <LinkedMeetingsDialog meeting={linkedFor} onClose={() => setLinkedFor(null)} />}
      {deleting && (
        <DeleteMeetingDialog
          meeting={deleting}
          deleting={deletingScope}
          error={deleteError}
          onDelete={(scope) => void deleteMeeting(scope)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
