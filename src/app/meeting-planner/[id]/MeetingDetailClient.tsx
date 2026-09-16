"use client"

import React, { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Clock,
  Loader2,
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
import { MeetingPrepView } from "@/components/meeting-planner/MeetingPrepView"
import { MeetingFormModal, formValuesOf, type MeetingFormValues } from "@/components/meeting-planner/MeetingFormModal"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { requestApi } from "@/lib/apiClient"
import { dayLabel, formatTime } from "@/lib/meetingDates"
import { MEETING_PLANNER_ENDPOINT, MEETING_PLANNER_MESSAGES } from "@/constants/meetingPlanner"
import type { MeetingPlanDetail } from "@/types/meetingPlanner"

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
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [isSavingStatus, setIsSavingStatus] = useState(false)
  const [isPreparing, setIsPreparing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
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

  const toggleStatus = async () => {
    if (!meeting || isSavingStatus) return
    const status = meeting.status === "completed" ? "pending" : "completed"
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
      setMeeting(data)
    } catch (error: unknown) {
      setMeeting(previous)
      setActionError(error instanceof Error ? error.message : MEETING_PLANNER_MESSAGES.updateFailed)
    } finally {
      setIsSavingStatus(false)
    }
  }

  // Only ever on request: a failed run can be tried again, and a finished one rewritten
  const runPreparation = async () => {
    if (!meeting || isPreparing) return
    setIsPreparing(true)
    setActionError(null)
    try {
      const { data } = await requestApi<MeetingPlanDetail>(`${MEETING_PLANNER_ENDPOINT}/${meeting.id}/prepare`, {
        method: "POST",
      })
      setMeeting(data)
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : MEETING_PLANNER_MESSAGES.prepFailed)
      reload()
    } finally {
      setIsPreparing(false)
    }
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
          prepEnabled: values.prepEnabled,
          profileInfo: values.profileInfo || null,
          conversationHistory: values.conversationHistory || null,
          additionalInfo: values.additionalInfo || null,
        }),
      })
      setMeeting(data)
      setIsEditing(false)
    } catch (error: unknown) {
      setEditError(error instanceof Error ? error.message : MEETING_PLANNER_MESSAGES.updateFailed)
    } finally {
      setIsSavingEdit(false)
    }
  }

  const deleteMeeting = async () => {
    if (!meeting || isDeleting) return
    setIsDeleting(true)
    try {
      await requestApi<{ deleted: boolean }>(`${MEETING_PLANNER_ENDPOINT}/${meeting.id}`, { method: "DELETE" })
      router.push("/meeting-planner")
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : MEETING_PLANNER_MESSAGES.deleteFailed)
      setIsDeleting(false)
      setIsConfirmingDelete(false)
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
              <div role="status" className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <Loader2 size={22} className="animate-spin text-primary" aria-hidden="true" />
                <p className="text-sm font-semibold text-on-surface">Loading the meeting...</p>
              </div>
            ) : loadError || !meeting ? (
              <div role="alert" className="flex flex-col items-center justify-center gap-3 py-16 text-center">
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
                      <h1 className="text-xl font-bold text-on-surface md:text-2xl">{meeting.name}</h1>
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
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <MeetingStatusButton meeting={meeting} isSaving={isSavingStatus} onToggle={toggleStatus} />
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
                        onClick={() => setIsConfirmingDelete(true)}
                        aria-label="Delete this meeting"
                        className="inline-flex items-center gap-2 rounded-xl border border-error/40 px-3 py-2 text-[13px] font-semibold text-error transition-colors hover:bg-error/5"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="min-h-[20px] text-[12px]" aria-live="polite">
                    {actionError && (
                      <p role="alert" className="text-error">
                        {actionError}
                      </p>
                    )}
                  </div>

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
                    </p>
                    {meeting.prepEnabled && (
                      <button
                        type="button"
                        onClick={runPreparation}
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

                {meeting.prep && <MeetingPrepView prep={meeting.prep} />}

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

      {isConfirmingDelete && meeting && (
        <Modal
          title="Delete this meeting?"
          description={`"${meeting.name}" and any preparation written for it will be removed for good.`}
          onClose={() => {
            if (!isDeleting) setIsConfirmingDelete(false)
          }}
          isCloseDisabled={isDeleting}
          size="compact"
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
                disabled={isDeleting}
                className="inline-flex items-center justify-center rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteMeeting}
                disabled={isDeleting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-error px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-error/90 disabled:opacity-50"
              >
                {isDeleting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Trash2 size={16} aria-hidden="true" />}
                {isDeleting ? "Deleting..." : "Delete meeting"}
              </button>
            </div>
          }
        >
          <p className="text-sm leading-relaxed text-on-surface-variant">
            This cannot be undone. The calendar entry, what you pasted and the written preparation all go.
          </p>
        </Modal>
      )}
    </div>
  )
}
