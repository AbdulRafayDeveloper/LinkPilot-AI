"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronUp, Loader2, Pencil, Play, RefreshCw, Trash2 } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { CopyButton } from "@/components/ui/CopyButton"
import { MeetingStatusBadge } from "@/components/meetings/MeetingStatusBadge"
import { MeetingAnalysisView } from "@/components/meetings/MeetingAnalysisView"
import { MeetingChatPanel } from "@/components/meeting-planner/MeetingChatPanel"
import { MeetingFormDialog } from "@/components/meetings/MeetingFormDialog"
import { DeleteMeetingDialog } from "@/components/meetings/DeleteMeetingDialog"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { useMeetingRun } from "@/hooks/useMeetingRun"
import { requestApi } from "@/lib/apiClient"
import { MEETINGS_ENDPOINT, MEETING_MESSAGES, TRANSCRIPT_PREVIEW_CHARS } from "@/constants/meetings"
import type { Meeting, MeetingInput } from "@/types/meetings"
import { AiSourceLabel } from "@/components/ui/AiSourceLabel"

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

export default function MeetingDetailClient({ id }: { id: string }) {
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadAttempt, setReloadAttempt] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  // The analysis is driven from here: each call reads a few parts, then the next call carries on
  const { run, isRunning, error: runError } = useMeetingRun(
    useCallback((state) => {
      setMeeting((current) =>
        current
          ? { ...current, status: state.status, statusMessage: state.statusMessage, progress: state.progress }
          : current
      )
      // The finished analysis itself is read back once the run says it is done
      if (!state.hasMore) setReloadAttempt((attempt) => attempt + 1)
    }, [])
  )
  const startedRef = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    requestApi<Meeting>(`${MEETINGS_ENDPOINT}/${id}`, { signal: controller.signal })
      .then(({ data }) => {
        setMeeting(data)
        setLoadError(null)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(error instanceof Error ? error.message : MEETING_MESSAGES.loadFailed)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [id, reloadAttempt])

  // A meeting that has been saved but not read yet starts by itself, once
  useEffect(() => {
    if (!meeting || startedRef.current || isRunning) return
    if (meeting.status === "saved" || meeting.status === "analyzing" || meeting.status === "summarizing") {
      startedRef.current = true
      void run(meeting.id)
    }
  }, [meeting, isRunning, run])

  const analyse = (restart: boolean) => {
    if (!meeting || isRunning) return
    startedRef.current = true
    void run(meeting.id, { restart })
  }

  const saveEdits = async (input: MeetingInput) => {
    if (!meeting || isSaving) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const { data } = await requestApi<Meeting>(`${MEETINGS_ENDPOINT}/${meeting.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      setMeeting(data)
      setIsEditing(false)
      // A changed transcript leaves the analysis out of date until it is run again
      startedRef.current = data.status !== "saved"
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : MEETING_MESSAGES.saveFailed)
    } finally {
      setIsSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!meeting || isDeleting) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await requestApi<{ deleted: number }>(`${MEETINGS_ENDPOINT}/${meeting.id}`, { method: "DELETE" })
      router.push("/meetings")
    } catch (error: unknown) {
      setDeleteError(error instanceof Error ? error.message : MEETING_MESSAGES.deleteFailed)
      setIsDeleting(false)
    }
  }

  const transcript = meeting?.transcript ?? ""
  const isTranscriptLong = transcript.length > TRANSCRIPT_PREVIEW_CHARS
  const shownTranscript = isTranscriptOpen || !isTranscriptLong ? transcript : `${transcript.slice(0, TRANSCRIPT_PREVIEW_CHARS)}…`
  const canAnalyse = meeting !== null && !isRunning && meeting.status !== "completed"
  const canReanalyse = meeting !== null && !isRunning && (meeting.status === "completed" || meeting.isAnalysisStale)

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
          <div className="max-w-[1400px] mx-auto flex flex-col gap-4 p-4 md:p-6 lg:p-8">
            <Link
              href="/meetings"
              className="inline-flex w-fit items-center gap-1.5 text-[12px] font-semibold text-outline transition-colors hover:text-primary"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              All meetings
            </Link>

            {isLoading ? (
              <div role="status" className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
                <Loader2 size={22} className="animate-spin text-primary" aria-hidden="true" />
                <p className="text-sm font-semibold text-on-surface">Loading the meeting...</p>
              </div>
            ) : !meeting ? (
              <div role="alert" className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-error-container text-error">
                  <AlertTriangle size={20} aria-hidden="true" />
                </div>
                <p className="max-w-sm text-sm leading-relaxed text-on-surface-variant">{loadError ?? MEETING_MESSAGES.notFound}</p>
                <button
                  type="button"
                  onClick={() => {
                    setIsLoading(true)
                    setReloadAttempt((attempt) => attempt + 1)
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : (
              <>
                {/* Title, status and what can be done with it */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-on-surface">
                      {meeting.title}
                      <MeetingStatusBadge status={meeting.status} progress={meeting.progress} />
                    </h1>
                    <p className="mt-1 text-[12px] text-outline">
                      Saved {when(meeting.createdAt)} · {meeting.transcriptChars.toLocaleString()} characters ·{" "}
                      {meeting.progress.totalChunks.toLocaleString()} parts
                      {meeting.analyzedAt && ` · analyzed ${when(meeting.analyzedAt)}`}
                      {meeting.isTitleGenerated && " · name written by the analysis"}
                      {meeting.analysis && <AiSourceLabel source={meeting.analysisSource} />}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:shrink-0">
                    {canAnalyse && (
                      <button
                        type="button"
                        onClick={() => analyse(false)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-on-primary-fixed-variant"
                      >
                        <Play size={16} aria-hidden="true" />
                        {meeting.status === "failed" ? "Analyse again" : "Analyse"}
                      </button>
                    )}
                    {canReanalyse && (
                      <button
                        type="button"
                        onClick={() => analyse(true)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                      >
                        <RefreshCw size={16} aria-hidden="true" />
                        Re-analyse
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSaveError(null)
                        setIsEditing(true)
                      }}
                      disabled={isRunning}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Pencil size={16} aria-hidden="true" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null)
                        setIsConfirmingDelete(true)
                      }}
                      disabled={isRunning}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-error/40 px-4 py-2.5 text-sm font-semibold text-error transition-colors hover:bg-error/5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                      Delete
                    </button>
                  </div>
                </div>

                {/* What is happening, and anything that went wrong */}
                {isRunning && (
                  <p role="status" className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-[12px] text-primary">
                    <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    {meeting.status === "summarizing"
                      ? "Putting the whole meeting together..."
                      : `Reading the transcript, part ${Math.min(meeting.progress.analyzedChunks + 1, meeting.progress.totalChunks)} of ${meeting.progress.totalChunks}...`}
                    <span className="text-on-surface-variant">You can leave this page; it carries on when you come back.</span>
                  </p>
                )}
                {(runError || (meeting.status === "failed" && meeting.statusMessage)) && (
                  <p role="alert" className="rounded-xl border border-error/40 bg-error-container px-3 py-2 text-[12px] text-error">
                    {runError ?? MEETING_MESSAGES.analysisFailed}
                    {meeting.statusMessage && <span className="ml-1 text-on-surface-variant">({meeting.statusMessage})</span>}
                  </p>
                )}
                {meeting.isAnalysisStale && (
                  <p role="status" className="rounded-xl border border-secondary-fixed-dim bg-secondary-fixed/40 px-3 py-2 text-[12px] text-on-secondary-fixed-variant">
                    {MEETING_MESSAGES.staleAnalysis} Press Re-analyse to rebuild it from the transcript as it is now.
                  </p>
                )}

                {/* The analysis */}
                {meeting.analysis ? (
                  <MeetingAnalysisView analysis={meeting.analysis} />
                ) : (
                  !isRunning && (
                    <p className="rounded-2xl border border-outline-variant bg-white p-6 text-center text-sm text-on-surface-variant shadow-sm">
                      This meeting has not been analyzed yet. Press Analyse to read the transcript.
                    </p>
                  )
                )}

                {/* Ask this meeting. The transcript alone is enough to answer from, so this is here
                    whether or not the meeting has been analysed yet */}
                <MeetingChatPanel surface="notes" meetingId={meeting.id} subject={meeting.title} />

                {/* The transcript, kept exactly as it was pasted */}
                <section className="flex flex-col gap-2 rounded-2xl border border-outline-variant bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-bold text-on-surface">Original notes</h2>
                    <div className="flex items-center gap-1">
                      <CopyButton text={transcript} label="Copy the whole transcript" showLabel />
                      {isTranscriptLong && (
                        <button
                          type="button"
                          onClick={() => setIsTranscriptOpen((open) => !open)}
                          aria-expanded={isTranscriptOpen}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-outline transition-colors hover:bg-surface-container hover:text-primary"
                        >
                          {isTranscriptOpen ? <ChevronUp size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}
                          {isTranscriptOpen ? "Show less" : "Show the whole transcript"}
                        </button>
                      )}
                    </div>
                  </div>
                  <pre className="custom-scrollbar max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-surface-container-lowest p-3 font-code text-[12px] leading-relaxed text-on-surface-variant">
                    {shownTranscript}
                  </pre>
                  {isTranscriptLong && !isTranscriptOpen && (
                    <p className="text-[11px] text-outline">
                      Showing the first {TRANSCRIPT_PREVIEW_CHARS.toLocaleString()} characters of {transcript.length.toLocaleString()}. Copy
                      takes all of it.
                    </p>
                  )}
                </section>
              </>
            )}
          </div>
        </main>
      </div>

      {isEditing && meeting && (
        <MeetingFormDialog
          meeting={meeting}
          isSaving={isSaving}
          error={saveError}
          onSave={saveEdits}
          onClose={() => {
            if (isSaving) return
            setIsEditing(false)
            setSaveError(null)
          }}
        />
      )}

      {isConfirmingDelete && meeting && (
        <DeleteMeetingDialog
          meeting={meeting}
          isDeleting={isDeleting}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={() => {
            if (isDeleting) return
            setIsConfirmingDelete(false)
            setDeleteError(null)
          }}
        />
      )}
    </div>
  )
}
