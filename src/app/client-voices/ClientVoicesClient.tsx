"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { AudioLines, FilePenLine, RotateCcw } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { VoiceInputPanel } from "@/components/client-voices/VoiceInputPanel"
import { TranscriptList } from "@/components/client-voices/TranscriptList"
import { TaskListPanel } from "@/components/client-voices/TaskListPanel"
import { ClientVoicesPromptModal } from "@/components/client-voices/ClientVoicesPromptModal"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { requestApi } from "@/lib/apiClient"
import { checkAudioFile, runWithLimit, transcribeVoice } from "@/lib/voiceBatch"
import {
  CLIENT_VOICES_ENDPOINT,
  CLIENT_VOICES_MESSAGES,
  VOICE_BATCH_MAX,
} from "@/constants/clientVoices"
import type { TaskExtraction, VoiceEntry, VoiceSource } from "@/types/clientVoices"

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `voice-${Date.now()}-${Math.random()}`

export default function ClientVoicesClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [voices, setVoices] = useState<VoiceEntry[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [tasks, setTasks] = useState<TaskExtraction | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isPromptOpen, setIsPromptOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const runRef = useRef<AbortController | null>(null)
  // The transcripts as they land, so the task step never reads a half-updated render
  const transcriptsRef = useRef(new Map<string, string>())

  // The batch belongs to this page and nothing else: leaving it drops the audio with it
  useEffect(() => () => runRef.current?.abort(), [])

  const update = useCallback((id: string, changes: Partial<VoiceEntry>) => {
    setVoices((current) => current.map((voice) => (voice.id === id ? { ...voice, ...changes } : voice)))
  }, [])

  /**
   * Adds what was pasted, dropped or chosen. Files are checked before they join the batch, and
   * the batch stops at VOICE_BATCH_MAX rather than quietly taking a sixteenth.
   */
  const addVoices = useCallback(
    (files: File[], source: VoiceSource) => {
      setNotice(null)
      setVoices((current) => {
        const accepted: VoiceEntry[] = []
        const problems: string[] = []
        for (const file of files) {
          if (current.length + accepted.length >= VOICE_BATCH_MAX) {
            problems.push(CLIENT_VOICES_MESSAGES.batchFull)
            break
          }
          const problem = checkAudioFile(file)
          if (problem) {
            problems.push(`${file.name || "That file"}: ${problem}`)
            continue
          }
          accepted.push({
            id: newId(),
            position: current.length + accepted.length + 1,
            file,
            name: file.name || `Voice ${current.length + accepted.length + 1}`,
            size: file.size,
            source,
            status: "ready",
            transcript: "",
            error: null,
          })
        }
        if (problems.length > 0) setNotice([...new Set(problems)].join(" "))
        return accepted.length > 0 ? [...current, ...accepted] : current
      })
    },
    []
  )

  // Removing renumbers what is left, so the positions always read 1, 2, 3 with no gaps
  const removeVoice = (id: string) => {
    transcriptsRef.current.delete(id)
    setVoices((current) =>
      current.filter((voice) => voice.id !== id).map((voice, index) => ({ ...voice, position: index + 1 }))
    )
  }

  /** Sends the transcripts that exist to the task step. Failed voices are named, not hidden. */
  const extractTasks = useCallback(async (batch: VoiceEntry[]) => {
    const done = batch.filter((voice) => transcriptsRef.current.get(voice.id))
    const missing = batch.filter((voice) => !transcriptsRef.current.get(voice.id))
    if (done.length === 0) {
      setTasks(null)
      setTaskError(CLIENT_VOICES_MESSAGES.noTranscripts)
      return
    }
    setIsExtracting(true)
    setTaskError(null)
    try {
      const { data } = await requestApi<TaskExtraction>(`${CLIENT_VOICES_ENDPOINT}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voices: done.map((voice) => ({ voice: voice.position, transcript: transcriptsRef.current.get(voice.id) })),
          missingVoices: missing.map((voice) => voice.position),
        }),
      })
      setTasks(data)
    } catch (error: unknown) {
      setTaskError(error instanceof Error ? error.message : CLIENT_VOICES_MESSAGES.tasksFailed)
    } finally {
      setIsExtracting(false)
    }
  }, [])

  /**
   * Runs the batch. Every voice is transcribed on its own, a few at a time, so one failure is
   * one voice rather than the batch, and the page can say which number it is up to.
   */
  const process = async (only?: VoiceEntry[]) => {
    if (isProcessing) return
    const batch = voices
    const toRun = only ?? batch
    if (toRun.length === 0) {
      setNotice(CLIENT_VOICES_MESSAGES.noVoices)
      return
    }
    const controller = new AbortController()
    runRef.current = controller
    setIsProcessing(true)
    setNotice(null)
    setTaskError(null)
    for (const voice of toRun) {
      transcriptsRef.current.delete(voice.id)
      update(voice.id, { status: "queued", transcript: "", error: null })
    }

    await runWithLimit({
      items: toRun,
      signal: controller.signal,
      run: async (voice) => {
        if (controller.signal.aborted) return
        update(voice.id, { status: "transcribing" })
        try {
          const transcript = await transcribeVoice(voice.file, controller.signal)
          transcriptsRef.current.set(voice.id, transcript)
          update(voice.id, { status: "done", transcript, error: null })
        } catch (error: unknown) {
          if (controller.signal.aborted) return
          const message = error instanceof Error && !(error instanceof TypeError) ? error.message : ""
          update(voice.id, { status: "failed", transcript: "", error: message || CLIENT_VOICES_MESSAGES.transcriptionFailed })
        }
      },
    })

    if (!controller.signal.aborted) await extractTasks(batch)
    setIsProcessing(false)
    runRef.current = null
  }

  /** One voice again, keeping every transcript that already worked. */
  const retryVoice = async (id: string) => {
    const voice = voices.find((entry) => entry.id === id)
    if (!voice) return
    await process([voice])
  }

  const startAgain = () => {
    runRef.current?.abort()
    transcriptsRef.current.clear()
    setVoices([])
    setTasks(null)
    setTaskError(null)
    setNotice(null)
    setIsProcessing(false)
  }

  const finished = voices.filter((voice) => voice.status === "done" || voice.status === "failed").length
  const failed = voices.filter((voice) => voice.status === "failed").length
  const hasResults = voices.some((voice) => voice.status !== "ready")

  return (
    <div className="font-body-md text-body-md flex h-screen min-h-screen overflow-hidden bg-background text-on-surface">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          onOpenSidebar={() => setIsSidebarOpen(true)}
          isSidebarCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapsed}
        />

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 md:p-6 lg:h-full lg:p-8">
            {/* Page header */}
            <div className="flex shrink-0 flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-2xl font-bold text-on-surface">
                  <AudioLines size={24} className="shrink-0 text-primary" aria-hidden="true" />
                  Client Voices to Tasks
                </h1>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Paste or drop the voice messages a client sent you. Each one comes back as English text, and
                  everything they asked for lands in one list.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:shrink-0">
                <button
                  type="button"
                  onClick={startAgain}
                  disabled={voices.length === 0 && !tasks}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                >
                  <RotateCcw size={16} aria-hidden="true" />
                  Clear batch
                </button>
                <button
                  type="button"
                  onClick={() => setIsPromptOpen(true)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high sm:flex-none"
                >
                  <FilePenLine size={16} aria-hidden="true" />
                  Update Prompt
                </button>
              </div>
            </div>

            {notice && (
              <p role="alert" className="shrink-0 rounded-xl border border-error/40 bg-error-container px-3 py-2 text-[12px] text-error">
                {notice}
              </p>
            )}

            <div className="grid grid-cols-1 gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
              <VoiceInputPanel
                voices={voices}
                isProcessing={isProcessing}
                onAdd={addVoices}
                onRemove={removeVoice}
                onProcess={() => void process()}
                onReject={setNotice}
              />

              <div className="custom-scrollbar flex min-h-0 flex-col gap-4 lg:overflow-y-auto lg:pr-1">
                {isProcessing && (
                  <p role="status" className="rounded-xl bg-primary-container px-3 py-2 text-[12px] font-semibold text-on-primary-container">
                    Processing {Math.min(finished + 1, voices.length)} of {voices.length} voices
                  </p>
                )}
                {!isProcessing && hasResults && (
                  <p className="rounded-xl bg-surface-container-high px-3 py-2 text-[12px] text-on-surface-variant" aria-live="polite">
                    {voices.length - failed} of {voices.length} voices written out
                    {failed > 0 && `, ${failed} failed`}.
                  </p>
                )}

                <TaskListPanel
                  result={tasks}
                  isWorking={isExtracting}
                  error={taskError}
                  onRetry={() => void extractTasks(voices)}
                />

                {voices.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h2 className="text-[10px] font-bold uppercase tracking-wider text-outline">Transcripts, one per voice</h2>
                    <TranscriptList voices={voices} isProcessing={isProcessing} onRetry={(id) => void retryVoice(id)} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {isPromptOpen && <ClientVoicesPromptModal onClose={() => setIsPromptOpen(false)} />}
    </div>
  )
}
