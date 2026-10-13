"use client"

import React, { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  Clock,
  ExternalLink,
  Loader2,
  NotebookPen,
  Pencil,
  RefreshCw,
  Sparkles,
  Trash2,
  User,
} from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { Modal } from "@/components/ui/Modal"
import { MeetingStatusButton } from "@/components/meeting-planner/MeetingStatusButton"
import { PrepBadge } from "@/components/meeting-planner/PrepBadge"
import { SeriesBadge } from "@/components/meeting-planner/SeriesBadge"
import { DeleteMeetingDialog } from "@/components/meeting-planner/DeleteMeetingDialog"
import { MeetingPrepView } from "@/components/meeting-planner/MeetingPrepView"
import { MeetingChatPanel } from "@/components/meeting-planner/MeetingChatPanel"
import { endConversationEdit, useConversationDraft } from "@/components/meeting-planner/ConversationEditor"
import { MeetingFormModal, formValuesOf, updateScopeOf, type MeetingFormValues } from "@/components/meeting-planner/MeetingFormModal"
import { JoinLink } from "@/components/meeting-planner/JoinLink"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { requestApi } from "@/lib/apiClient"
import { dayLabel, formatTime } from "@/lib/meetingDates"
import {
  MEETING_PLANNER_ENDPOINT,
  MEETING_PLANNER_MESSAGES,
  type DeleteScopeId,
  type MeetingPlanStatusId,
  type UpdateScopeId,
} from "@/constants/meetingPlanner"
import type { MeetingPlan, MeetingPlanDetail } from "@/types/meetingPlanner"
import { MeetingNotesModal } from "@/components/meeting-planner/MeetingNotesModal"
import { MoveMeetingModal } from "@/components/meeting-planner/MoveMeetingModal"
import { ExtendSeriesModal } from "@/components/meeting-planner/ExtendSeriesModal"
import { RichTextView } from "@/components/ui/RichTextView"
import { AiSourceLabel } from "@/components/ui/AiSourceLabel"

/** One of the three things the user pasted, shown only when there is something to show. */
const SuppliedText: React.FC<{ title: string; text: string | null }> = ({ title, text }) =>
  text ? (
    <section className="flex flex-col gap-2 rounded-2xl border border-outline-variant bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold text-on-surface">{title}</h2>
      <p className="custom-scrollbar max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-[13px] leading-relaxed text-on-surface-variant">
        {text}
      </p>
    </section>
  ) : null

export default function MeetingDetailClient({ meetingId }: { meetingId: string }) {
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [meeting, setMeeting] = useState<MeetingPlanDetail | null>(null)
  // Only the meeting's own GET counts its series, so a later answer (a status, an edit) keeps that count
  const showMeeting = (data: MeetingPlanDetail) =>
    setMeeting((current) => ({ ...data, seriesSize: data.seriesSize ?? current?.seriesSize }))
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [isSavingStatus, setIsSavingStatus] = useState(false)
  const [isPreparing, setIsPreparing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  // What just worked (the series extended), said once rather than left to be guessed from the page
  const [notice, setNotice] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  // Which delete is running: this meeting, or the whole series it belongs to
  const [deletingScope, setDeletingScope] = useState<DeleteScopeId | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isWritingNotes, setIsWritingNotes] = useState(false)
  // Changing the day or time with a choice of this meeting or the whole series
  const [isMoving, setIsMoving] = useState(false)
  const [isSavingMove, setIsSavingMove] = useState(false)
  const [moveError, setMoveError] = useState<string | null>(null)
  // Making the series run for longer, from this meeting of it
  const [isExtending, setIsExtending] = useState(false)
  const [isSavingExtend, setIsSavingExtend] = useState(false)
  const [extendError, setExtendError] = useState<string | null>(null)
  const [isConfirmingPrepare, setIsConfirmingPrepare] = useState(false)
  // A new preparation replaces the conversation, so an edited or half-edited one is confirmed first
  const draft = useConversationDraft()
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()

  // The meeting, including any preparation already written, is read from the database. Nothing
  // is generated here, so opening this page never calls a model.
  useEffect(() => {
    const controller = new AbortController()
    requestApi<MeetingPlanDetail>(`${MEETING_PLANNER_ENDPOINT}/${meetingId}`, { signal: controller.signal })
      .then(({ data }) => {
        setMeeting(data)
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
  }, [meetingId, loadAttempt])

  const reload = useCallback(() => {
    setIsLoading(true)
    setLoadAttempt((attempt) => attempt + 1)
  }, [])

  const changeStatus = async (_meeting: MeetingPlan, status: MeetingPlanStatusId) => {
    if (!meeting || isSavingStatus) return
    setIsSavingStatus(true)
    setActionError(null)
    const previous = meeting
    setMeeting({ ...meeting, status })
    try {
      const { data } = await requestApi<MeetingPlanDetail>(`${MEETING_PLANNER_ENDPOINT}/${meeting.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      showMeeting(data)
    } catch (error: unknown) {
      setMeeting(previous)
      setActionError(error instanceof Error ? error.message : MEETING_PLANNER_MESSAGES.updateFailed)
    } finally {
      setIsSavingStatus(false)
    }
  }

  /**
   * Changes the day or time. With the series scope it becomes the series' own time: this meeting and
   * every later one of it move, and a changed day moves them all by the same number of days.
   */
  const moveMeeting = async (meetingDate: string, meetingTime: string, scope: UpdateScopeId) => {
    if (!meeting || isSavingMove) return
    setIsSavingMove(true)
    setMoveError(null)
    try {
      const { data, message } = await requestApi<MeetingPlanDetail>(`${MEETING_PLANNER_ENDPOINT}/${meeting.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingDate, meetingTime, scope }),
      })
      showMeeting(data)
      setIsMoving(false)
      setActionError(null)
      setNotice(scope === "series" ? message || MEETING_PLANNER_MESSAGES.seriesUpdated : MEETING_PLANNER_MESSAGES.moved)
    } catch (error: unknown) {
      setMoveError(error instanceof Error ? error.message : MEETING_PLANNER_MESSAGES.updateFailed)
    } finally {
      setIsSavingMove(false)
    }
  }

  /**
   * Makes the series run for the next `count` meetings after this one. The answer says how many were
   * added, and the meeting is read again so its series count and the notice agree with the database.
   */
  const extendSeries = async (count: number) => {
    if (!meeting || isSavingExtend) return
    setIsSavingExtend(true)
    setExtendError(null)
    try {
      const { message } = await requestApi<{ added: number; seriesSize: number; lastDate: string }>(
        `${MEETING_PLANNER_ENDPOINT}/${meeting.id}/series`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count }) },
        // It creates meetings, so a retry carries the same key and can never add them twice
        { idempotent: true }
      )
      setIsExtending(false)
      setActionError(null)
      setNotice(message || MEETING_PLANNER_MESSAGES.seriesExtended)
      reload()
    } catch (error: unknown) {
      setExtendError(error instanceof Error ? error.message : MEETING_PLANNER_MESSAGES.extendFailed)
    } finally {
      setIsSavingExtend(false)
    }
  }

  // Only ever on request: a failed run can be tried again, and a finished one rewritten
  const runPreparation = async () => {
    if (!meeting || isPreparing) return
    setIsConfirmingPrepare(false)
    if (draft.meetingId === meeting.id) endConversationEdit()
    setIsPreparing(true)
    setActionError(null)
    try {
      const { data } = await requestApi<MeetingPlanDetail>(`${MEETING_PLANNER_ENDPOINT}/${meeting.id}/prepare`, {
        method: "POST",
      }, { retry: true })
      showMeeting(data)
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : MEETING_PLANNER_MESSAGES.prepFailed)
      reload()
    } finally {
      setIsPreparing(false)
    }
  }

  const requestPreparation = () => {
    const hasOwnConversation = Boolean(meeting?.prep?.conversation_edited_at) || draft.meetingId === meeting?.id
    if (hasOwnConversation) setIsConfirmingPrepare(true)
    else void runPreparation()
  }

  const saveEdit = async (values: MeetingFormValues) => {
    if (!meeting || isSavingEdit) return
    setIsSavingEdit(true)
    setEditError(null)
    try {
      const { data } = await requestApi<MeetingPlanDetail>(`${MEETING_PLANNER_ENDPOINT}/${meeting.id}`, {
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
          // "series" only when the form's own tick box asked for it, so an ordinary edit is
          // exactly the one-meeting change it always was
          scope: updateScopeOf(values),
        }),
      })
      showMeeting(data)
      setIsEditing(false)
      if (values.applyToSeries) setNotice(MEETING_PLANNER_MESSAGES.seriesLinkApplied)
    } catch (error: unknown) {
      setEditError(error instanceof Error ? error.message : MEETING_PLANNER_MESSAGES.updateFailed)
    } finally {
      setIsSavingEdit(false)
    }
  }

  // One meeting, or with "series" every meeting of its series; either way the page has nothing left to show
  const deleteMeeting = async (scope: DeleteScopeId) => {
    if (!meeting || deletingScope) return
    setDeletingScope(scope)
    setDeleteError(null)
    try {
      await requestApi<{ deleted: boolean; count: number }>(
        `${MEETING_PLANNER_ENDPOINT}/${meeting.id}${scope === "series" ? "?scope=series" : ""}`,
        { method: "DELETE" }
      )
      router.push("/meeting-planner")
    } catch (error: unknown) {
      setDeleteError(error instanceof Error ? error.message : MEETING_PLANNER_MESSAGES.deleteFailed)
      setDeletingScope(null)
    }
  }


  const hasSupplied = Boolean(meeting?.profileInfo || meeting?.conversationHistory || meeting?.additionalInfo)

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
          <div className="mx-auto flex max-w-[1000px] flex-col gap-5 p-4 md:p-6 lg:p-8">
            <Link
              href="/meeting-planner"
              className="inline-flex w-fit items-center gap-2 rounded-lg text-[13px] font-semibold text-on-surface-variant transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              All meetings
            </Link>

            {isLoading && !meeting ? (
              <div role="status" className="flex flex-col items-center justify-center gap-3 py-16 short:py-5 text-center">
                <Loader2 size={22} className="animate-spin text-primary" aria-hidden="true" />
                <p className="text-sm font-semibold text-on-surface">Loading the meeting...</p>
              </div>
            ) : loadError || !meeting ? (
              <div role="alert" className="flex flex-col items-center justify-center gap-3 py-16 short:py-5 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-error-container text-error">
                  <AlertTriangle size={20} aria-hidden="true" />
                </div>
                <p className="max-w-sm text-sm leading-relaxed text-on-surface-variant">
                  {loadError ?? MEETING_PLANNER_MESSAGES.notFound}
                </p>
                <button
                  type="button"
                  onClick={reload}
                  className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : (
              <>
                {/* The meeting itself */}
                <section className="flex flex-col gap-4 rounded-2xl border border-outline-variant bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-xl font-bold text-on-surface md:text-2xl">{meeting.name}</h1>
                        <PrepBadge meeting={isPreparing ? { prepEnabled: true, prepStatus: "generating" } : meeting} />
                        <SeriesBadge meeting={meeting} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-on-surface-variant">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays size={14} className="text-outline" aria-hidden="true" />
                          {dayLabel(meeting.meetingDate, { year: "numeric" })}
                        </span>
                        <span className="inline-flex items-center gap-1.5 font-semibold text-on-surface tabular-nums">
                          <Clock size={14} className="text-outline" aria-hidden="true" />
                          {formatTime(meeting.meetingTime)}
                        </span>
                        {meeting.personName && (
                          <span className="inline-flex items-center gap-1.5">
                            <User size={14} className="text-outline" aria-hidden="true" />
                            {meeting.personName}
                          </span>
                        )}
                        {/* Their profile, one click away during the call, like a project's own link */}
                        {meeting.profileLink && (
                          <a
                            href={meeting.profileLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 font-semibold text-primary underline underline-offset-2 transition-colors hover:text-on-primary-fixed-variant"
                          >
                            <ExternalLink size={14} aria-hidden="true" />
                            Open profile
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <MeetingStatusButton meeting={meeting} isSaving={isSavingStatus} onChange={changeStatus} />
                      {/* Notes, before the meeting or after it. The dot says there is something to read. */}
                      <button
                        type="button"
                        onClick={() => setIsWritingNotes(true)}
                        className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-3 py-2 text-[13px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                      >
                        <NotebookPen size={14} aria-hidden="true" />
                        Notes
                        {meeting.hasNotes && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="has notes" />}
                      </button>
                      {/* A repeating meeting's time is changed here, for this one or for the series.
                          A one-off meeting's day and time are part of Edit, as they always were. */}
                      {meeting.seriesId && (
                        <button
                          type="button"
                          onClick={() => {
                            setMoveError(null)
                            setIsMoving(true)
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-3 py-2 text-[13px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                        >
                          <Clock size={14} aria-hidden="true" />
                          Day or time
                        </button>
                      )}
                      {meeting.seriesId && (
                        <button
                          type="button"
                          onClick={() => {
                            setExtendError(null)
                            setIsExtending(true)
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-3 py-2 text-[13px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                        >
                          <CalendarPlus size={14} aria-hidden="true" />
                          Repeat for longer
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditError(null)
                          setIsEditing(true)
                        }}
                        className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-3 py-2 text-[13px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                      >
                        <Pencil size={14} aria-hidden="true" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null)
                          setIsConfirmingDelete(true)
                        }}
                        aria-label="Delete this meeting"
                        className="inline-flex items-center gap-2 rounded-xl border border-error/40 px-3 py-2 text-[13px] font-semibold text-error transition-colors hover:bg-error/5"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="min-h-[20px] text-[12px]" aria-live="polite">
                    {actionError ? (
                      <p role="alert" className="text-error">
                        {actionError}
                      </p>
                    ) : (
                      notice && <p className="font-semibold text-success">{notice}</p>
                    )}
                  </div>

                  {/* How the meeting is attended, high on the page: Join as it starts, Copy to send it on */}
                  <JoinLink url={meeting.joinUrl} name={meeting.name} variant="panel" />

                    {/* The notes themselves, read without opening anything, so a meeting says what it
                      is for at a glance. Writing them is the Notes button above. */}
                  {meeting.notes.trim() && (
                    <div className="flex flex-col gap-2 rounded-xl border border-outline-variant bg-surface-container-low p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="flex items-center gap-2 text-sm font-bold text-on-surface">
                          <NotebookPen size={15} className="text-primary" aria-hidden="true" />
                          Notes
                        </h2>
                        <div className="flex items-center gap-2">
                          {meeting.notesUpdatedAt && (
                            <span className="text-[11px] text-outline">
                              Written{" "}
                              {new Date(meeting.notesUpdatedAt).toLocaleString(undefined, {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setIsWritingNotes(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-white px-2.5 py-1 text-[11px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                          >
                            <Pencil size={12} aria-hidden="true" />
                            Edit notes
                          </button>
                        </div>
                      </div>
                      <div className="custom-scrollbar max-h-72 overflow-y-auto">
                        <RichTextView text={meeting.notes} />
                      </div>
                    </div>
                  )}

                {/* Preparation: its state, and the button that writes or rewrites it */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-3">
                    <p className="flex items-center gap-2 text-[13px] text-on-surface-variant">
                      <Sparkles size={15} className="shrink-0 text-primary" aria-hidden="true" />
                      {!meeting.prepEnabled
                        ? "Preparation is off for this meeting. Turn it on with Edit and add whatever you know about them."
                        : isPreparing || meeting.prepStatus === "generating"
                          ? "Writing the preparation. It is saved with the meeting when it finishes."
                          : meeting.prepStatus === "failed"
                            ? meeting.prepError || MEETING_PLANNER_MESSAGES.prepFailed
                            : meeting.preparedAt
                              ? `Prepared ${new Date(meeting.preparedAt).toLocaleString(undefined, {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}`
                              : "Ready to prepare."}
                      {meeting.prepEnabled && meeting.prepStatus === "ready" && !isPreparing && <AiSourceLabel source={meeting.prep} />}
                    </p>
                    {meeting.prepEnabled && (
                      <button
                        type="button"
                        onClick={requestPreparation}
                        disabled={isPreparing}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isPreparing ? (
                          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <RefreshCw size={14} aria-hidden="true" />
                        )}
                        {isPreparing
                          ? "Preparing..."
                          : meeting.prep
                            ? "Prepare again"
                            : meeting.prepStatus === "failed"
                              ? "Try again"
                              : "Prepare now"}
                      </button>
                    )}
                  </div>
                </section>

                {meeting.prep && <MeetingChatPanel surface="plan" meetingId={meeting.id} subject={meeting.personName || meeting.name} />}

                {meeting.prep && (
                  <MeetingPrepView
                    prep={meeting.prep}
                    meetingId={meeting.id}
                    meetingName={meeting.name}
                    isPreparing={isPreparing || meeting.prepStatus === "generating"}
                    onMeetingSaved={setMeeting}
                  />
                )}

                {hasSupplied && (
                  <div className="flex flex-col gap-5">
                    <h2 className="text-[10px] font-bold uppercase tracking-wider text-outline">What you supplied</h2>
                    <SuppliedText title="Their profile" text={meeting.profileInfo} />
                    <SuppliedText title="Your conversation so far" text={meeting.conversationHistory} />
                    <SuppliedText title="Anything else that matters" text={meeting.additionalInfo} />
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {isEditing && meeting && (
        <MeetingFormModal
          title="Edit meeting"
          initial={formValuesOf(meeting)}
          existing={meeting}
          isSaving={isSavingEdit}
          error={editError}
          onSubmit={saveEdit}
          onClose={() => {
            if (isSavingEdit) return
            setIsEditing(false)
            setEditError(null)
          }}
        />
      )}

      {isConfirmingPrepare && meeting && (
        <Modal
          title="Prepare this meeting again?"
          description="A new preparation replaces the conversation, including the changes you made to it."
          onClose={() => setIsConfirmingPrepare(false)}
          size="compact"
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsConfirmingPrepare(false)}
                className="inline-flex items-center justify-center rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
              >
                Keep my conversation
              </button>
              <button
                type="button"
                onClick={() => void runPreparation()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant"
              >
                <RefreshCw size={16} aria-hidden="true" />
                Prepare again
              </button>
            </div>
          }
        >
          <p className="text-sm leading-relaxed text-on-surface-variant">
            Your edits to the conversation can&apos;t be brought back afterwards.
          </p>
        </Modal>
      )}

      {isWritingNotes && meeting && (
        <MeetingNotesModal
          meeting={meeting}
          notes={meeting.notes}
          onSaved={showMeeting}
          onClose={() => setIsWritingNotes(false)}
        />
      )}

      {isMoving && meeting && (
        <MoveMeetingModal
          meeting={meeting}
          isSaving={isSavingMove}
          error={moveError}
          onSubmit={(meetingDate, meetingTime, scope) => void moveMeeting(meetingDate, meetingTime, scope)}
          onClose={() => {
            if (isSavingMove) return
            setIsMoving(false)
            setMoveError(null)
          }}
        />
      )}

      {isExtending && meeting && (
        <ExtendSeriesModal
          meeting={meeting}
          isSaving={isSavingExtend}
          error={extendError}
          onSubmit={(count) => void extendSeries(count)}
          onClose={() => {
            if (isSavingExtend) return
            setIsExtending(false)
            setExtendError(null)
          }}
        />
      )}

      {isConfirmingDelete && meeting && (
        <DeleteMeetingDialog
          meeting={meeting}
          seriesSize={meeting.seriesSize}
          deleting={deletingScope}
          error={deleteError}
          onDelete={(scope) => void deleteMeeting(scope)}
          onClose={() => setIsConfirmingDelete(false)}
        />
      )}
    </div>
  )
}
