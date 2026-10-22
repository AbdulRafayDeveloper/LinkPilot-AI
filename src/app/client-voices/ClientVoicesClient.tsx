"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AudioLines, FilePenLine, History, RotateCcw, Users } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { VoiceInputPanel } from "@/components/client-voices/VoiceInputPanel"
import { TranscriptList } from "@/components/client-voices/TranscriptList"
import { TaskListPanel } from "@/components/client-voices/TaskListPanel"
import { QuestionListPanel } from "@/components/client-voices/QuestionListPanel"
import { ClientVoicesPromptModal } from "@/components/client-voices/ClientVoicesPromptModal"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { requestApi } from "@/lib/apiClient"
import { checkAudioFile, runWithLimit, transcribeVoice } from "@/lib/voiceBatch"
import { measureDuration } from "@/lib/voiceDuration"
import {
  BATCH_TITLE_MAX_LENGTH,
  CLIENT_CHOICE_KEY,
  CLIENT_VOICES_ENDPOINT,
  CLIENT_VOICES_HISTORY_HREF,
  CLIENT_VOICES_MESSAGES,
  TEMPORARY_CHOICE_KEY,
  VOICE_BATCHES_ENDPOINT,
  VOICE_BATCH_MAX,
  VOICE_CHOICES_ENDPOINT,
  clientVoicesBatchHref,
} from "@/constants/clientVoices"
import { CLIENT_MESSAGING_ENDPOINT } from "@/constants/clientMessaging"
import type { Client } from "@/types/clientMessaging"
import type { SavedVoice, TaskExtraction, VoiceBatch, VoiceChoices, VoiceEntry, VoiceSource } from "@/types/clientVoices"

/**
 * The page's two choices: the client a batch is kept under, and whether it is kept at all. Both are
 * **choices, not work**, so they stay exactly as they were left until the user changes them: the
 * account is where they live, and this browser keeps a copy only so the page can show them before
 * the account has answered.
 */
const readInBrowser = (key: string) => {
  try {
    return window.localStorage.getItem(key) ?? ""
  } catch {
    return ""
  }
}

const rememberInBrowser = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // The account still remembers it; this browser just won't show it before the account answers
  }
}

// Either choice may be sent on its own, so changing one says nothing about the other
const rememberOnAccount = (choice: Partial<VoiceChoices>) =>
  requestApi<VoiceChoices>(VOICE_CHOICES_ENDPOINT, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(choice),
  })

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
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState("")
  // The batch's own name, left empty for one written from the voices themselves
  const [title, setTitle] = useState("")
  // Run the batch and keep nothing at all. A choice, so it is still on at the next visit
  const [isTemporary, setIsTemporary] = useState(false)
  const runRef = useRef<AbortController | null>(null)
  // The batch this run is kept under, started before the first voice is written out
  const batchRef = useRef<string | null>(null)
  const [batchId, setBatchId] = useState<string | null>(null)
  // The ids of the voices kept in this run, so the lists can point back at the recordings
  const savedIdsRef = useRef(new Map<string, string>())
  // The transcripts as they land, so the task step never reads a half-updated render
  const transcriptsRef = useRef(new Map<string, string>())

  // The batch belongs to this page and nothing else: leaving it drops the audio with it
  useEffect(() => () => runRef.current?.abort(), [])

  /**
   * The clients to choose from are the ones Client Tasks Messaging already keeps, and the page opens on
   * the one chosen last time. The account's choice wins, so it is the same on every browser; this
   * browser's copy is only used when the account has none, and is then handed to the account, so a
   * choice made before the account remembered it is not lost. A client that no longer exists opens as none.
   */
  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      requestApi<Client[]>(`${CLIENT_MESSAGING_ENDPOINT}/clients`, { signal: controller.signal }),
      requestApi<VoiceChoices>(VOICE_CHOICES_ENDPOINT, { signal: controller.signal }).catch(() => null),
    ])
      .then(([{ data }, account]) => {
        setClients(data)
        const exists = (id: string) => Boolean(id) && data.some((client) => client.id === id)
        const onAccount = account?.data.clientId ?? ""
        const inBrowser = readInBrowser(CLIENT_CHOICE_KEY)
        const chosen = exists(onAccount) ? onAccount : exists(inBrowser) ? inBrowser : ""
        setClientId(chosen)
        rememberInBrowser(CLIENT_CHOICE_KEY, chosen)
        if (account && chosen && chosen !== onAccount) void rememberOnAccount({ clientId: chosen }).catch(() => undefined)
        // The account's choice wins; what this browser last saw is only for when it cannot be asked
        const temporary = account ? account.data.isTemporary : readInBrowser(TEMPORARY_CHOICE_KEY) === "true"
        setIsTemporary(temporary)
        rememberInBrowser(TEMPORARY_CHOICE_KEY, String(temporary))
      })
      .catch(() => setIsTemporary(readInBrowser(TEMPORARY_CHOICE_KEY) === "true"))
    return () => controller.abort()
  }, [])

  // The page changes at once; the account is told in the background, and says so if it couldn't be
  const chooseClient = (id: string) => {
    setClientId(id)
    rememberInBrowser(CLIENT_CHOICE_KEY, id)
    rememberOnAccount({ clientId: id }).catch((error: unknown) =>
      setNotice(error instanceof Error && error.message ? error.message : CLIENT_VOICES_MESSAGES.clientChoiceFailed)
    )
  }

  /** Whether a batch is kept at all. Nothing but this changes it, so it holds for every later visit. */
  const chooseTemporary = (temporary: boolean) => {
    setIsTemporary(temporary)
    rememberInBrowser(TEMPORARY_CHOICE_KEY, String(temporary))
    rememberOnAccount({ isTemporary: temporary }).catch((error: unknown) =>
      setNotice(error instanceof Error && error.message ? error.message : CLIENT_VOICES_MESSAGES.temporaryChoiceFailed)
    )
  }

  const chosenClient = clients.find((client) => client.id === clientId) ?? null

  const update = useCallback((id: string, changes: Partial<VoiceEntry>) => {
    setVoices((current) => current.map((voice) => (voice.id === id ? { ...voice, ...changes } : voice)))
  }, [])

  /**
   * How long a recording runs, measured here because nothing on the server can read it without
   * decoding the audio, and the browser has already decoded enough to play it. It is kept with the
   * voice, so a batch's page says how long each one is without its player having to load anything.
   */
  const measure = useCallback(
    (entries: VoiceEntry[]) => {
      for (const entry of entries) {
        void measureDuration(entry.file).then((seconds) => {
          if (seconds > 0) update(entry.id, { seconds })
        })
      }
    },
    [update]
  )

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
        // Measured outside the updater: React runs one while it renders, and this is an effect of its own
        if (accepted.length > 0) queueMicrotask(() => measure(accepted))
        return accepted.length > 0 ? [...current, ...accepted] : current
      })
    },
    [measure]
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
          // Each transcript carries the kept voice it belongs to, so its clear words are written onto it
          voices: done.map((voice) => ({
            voice: voice.position,
            transcript: transcriptsRef.current.get(voice.id),
            ...(savedIdsRef.current.get(voice.id) ? { voiceId: savedIdsRef.current.get(voice.id) } : {}),
          })),
          missingVoices: missing.map((voice) => voice.position),
          // The batch the lists are written onto, and the recordings they were made from
          ...(batchRef.current ? { batchId: batchRef.current } : {}),
          ...(clientId ? { clientId } : {}),
          voiceIds: done.map((voice) => savedIdsRef.current.get(voice.id)).filter(Boolean),
          // The user's own name for it, and whether this batch is kept at all
          title: title.trim(),
          temporary: isTemporary,
        }),
      }, { retry: true })
      setTasks(data)
      // Each voice's clear words land on the voice they came from, under its own transcript
      const clear = new Map((data.clear ?? []).map((entry) => [entry.voice, entry.points]))
      if (clear.size > 0) {
        setVoices((current) => current.map((voice) => ({ ...voice, clearPoints: clear.get(voice.position) ?? voice.clearPoints })))
      }
      // The route starts a batch for a run that somehow had none, so the page can still link to it
      if (data.batchId && !batchRef.current) {
        batchRef.current = data.batchId
        setBatchId(data.batchId)
      }
    } catch (error: unknown) {
      setTaskError(error instanceof Error ? error.message : CLIENT_VOICES_MESSAGES.tasksFailed)
    } finally {
      setIsExtracting(false)
    }
  }, [clientId, title, isTemporary])

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
      update(voice.id, { status: "queued", transcript: "", clearPoints: [], error: null })
    }

    /**
     * A batch that is kept is started before a single voice is written out, so a run whose task step
     * never finishes still leaves its recordings and transcripts saved and openable. A batch that
     * cannot be started says so and the run carries on, since the transcripts are worth having
     * either way; it is wrapped in `withIdempotency`, so a retried request starts only one.
     *
     * **"Use these once" starts none at all**, which is the whole of that choice: with no batch,
     * nothing below keeps a recording and the task step is told to write nothing down either.
     */
    if (!batchRef.current && !isTemporary) {
      try {
        const { data: started } = await requestApi<VoiceBatch>(
          VOICE_BATCHES_ENDPOINT,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId, title: title.trim(), voiceCount: batch.length }),
          },
          { idempotent: true }
        )
        batchRef.current = started.id
        setBatchId(started.id)
      } catch (error: unknown) {
        setNotice(error instanceof Error && error.message ? error.message : CLIENT_VOICES_MESSAGES.batchFailed)
      }
    }
    const keptUnder = batchRef.current

    await runWithLimit({
      items: toRun,
      signal: controller.signal,
      run: async (voice) => {
        if (controller.signal.aborted) return
        update(voice.id, { status: "transcribing" })
        try {
          const { text: transcript, provider } = await transcribeVoice(voice.file, controller.signal)
          transcriptsRef.current.set(voice.id, transcript)
          update(voice.id, { status: "done", transcript, transcribedBy: provider, error: null })
          /**
           * The recording and its transcript are kept with the batch, whether or not a client was
           * chosen: the client only says whose batch it is. A failure here costs the transcript
           * nothing, since it is already on the page, and a voice already kept is never kept twice.
           */
          if (keptUnder && !savedIdsRef.current.has(voice.id)) {
            try {
              const form = new FormData()
              form.append("audio", voice.file, voice.name)
              form.append("batchId", keptUnder)
              form.append("position", String(voice.position))
              form.append("name", voice.name)
              form.append("transcript", transcript)
              if (provider) form.append("transcribedBy", provider)
              if (voice.seconds) form.append("seconds", String(Math.round(voice.seconds)))
              const { data: saved } = await requestApi<SavedVoice>(`${CLIENT_VOICES_ENDPOINT}/records`, { method: "POST", body: form })
              savedIdsRef.current.set(voice.id, saved.id)
            } catch (error: unknown) {
              setNotice(error instanceof Error ? error.message : CLIENT_VOICES_MESSAGES.saveFailed)
            }
          }
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

  // The batch already run is kept and stays openable from the list; this only clears the page
  const startAgain = () => {
    runRef.current?.abort()
    transcriptsRef.current.clear()
    savedIdsRef.current.clear()
    batchRef.current = null
    setBatchId(null)
    setTitle("")
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
          <div className="mx-auto flex max-w-[1400px] flex-col gap-5 short:gap-3 p-4 md:p-6 lg:h-full lg:p-8">
            {/* Page header */}
            <div className="flex shrink-0 flex-col justify-between gap-3 xl:flex-row xl:items-center">
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
              <div className="flex flex-wrap items-center gap-2 xl:shrink-0">
                {/* The client the batch belongs to: small, showing only the choice, and it decides what is kept.
                    On a phone it takes its own line, so the chosen name is never squeezed out by the buttons */}
                <label
                  title={chosenClient ? CLIENT_VOICES_MESSAGES.keptWith(chosenClient.name) : CLIENT_VOICES_MESSAGES.noClient}
                  className="inline-flex min-h-10 w-full min-w-0 items-center gap-2 rounded-xl border border-outline-variant bg-white pl-3 pr-1 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25 sm:w-auto"
                >
                  <Users size={15} className="shrink-0 text-primary" aria-hidden="true" />
                  <span className="sr-only">Client</span>
                  <select
                    id="client-voices-client"
                    value={clientId}
                    onChange={(event) => chooseClient(event.target.value)}
                    aria-describedby="client-voices-client-hint"
                    className="min-w-0 max-w-full flex-1 cursor-pointer truncate bg-transparent py-2 pr-1 text-sm font-semibold text-on-surface focus:outline-none sm:w-44 sm:flex-none"
                  >
                    <option value="">No client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                  <span id="client-voices-client-hint" className="sr-only">
                    {chosenClient ? CLIENT_VOICES_MESSAGES.keptWith(chosenClient.name) : CLIENT_VOICES_MESSAGES.noClient}
                  </span>
                </label>
                <Link
                  href={CLIENT_VOICES_HISTORY_HREF}
                  className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high sm:flex-none"
                >
                  <History size={16} aria-hidden="true" />
                  Saved Batches
                </Link>
                <button
                  type="button"
                  onClick={startAgain}
                  disabled={voices.length === 0 && !tasks}
                  className="inline-flex flex-1 items-center justify-center whitespace-nowrap gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                >
                  <RotateCcw size={16} aria-hidden="true" />
                  Clear batch
                </button>
                <button
                  type="button"
                  onClick={() => setIsPromptOpen(true)}
                  className="inline-flex flex-1 items-center justify-center whitespace-nowrap gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high sm:flex-none"
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

            {/* The voices are what goes in and the tasks are what the page is for, so the batch takes
                30% and the task list and the transcripts get the rest. The 260px floor only binds
                below about 1300px, where a 30% column wrapped the drop zone's words into so many
                lines that the page gained 138px of scrolling (measured at 1093x540). */}
            <div className="grid grid-cols-1 gap-5 short:gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(260px,30fr)_minmax(0,70fr)]">
              <div className="flex min-w-0 flex-col gap-4">
                {/* What this batch is called, and whether it is kept: both belong with what goes in */}
                <section className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-white p-4 shadow-sm">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-outline">{CLIENT_VOICES_MESSAGES.title}</span>
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      maxLength={BATCH_TITLE_MAX_LENGTH}
                      placeholder={CLIENT_VOICES_MESSAGES.titlePlaceholder}
                      className="w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                    />
                    <span className="text-[11px] text-outline">{CLIENT_VOICES_MESSAGES.titleHint}</span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      checked={isTemporary}
                      onChange={(event) => chooseTemporary(event.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                    />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-on-surface">{CLIENT_VOICES_MESSAGES.temporary}</span>
                      <span className="block text-[11px] text-outline">{CLIENT_VOICES_MESSAGES.temporaryHint}</span>
                    </span>
                  </label>
                </section>

                <VoiceInputPanel
                  voices={voices}
                  isProcessing={isProcessing}
                  onAdd={addVoices}
                  onRemove={removeVoice}
                  onProcess={() => void process()}
                  onReject={setNotice}
                />
              </div>

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

                {/* What they asked, beside what they asked for and never folded into it */}
                <QuestionListPanel
                  questions={tasks?.questions ?? null}
                  isWorking={isExtracting}
                  waitingLabel="Anything the client asked lands here, apart from the work."
                />

                {/* Everything above is already kept, so this is a way in rather than a save button */}
                {batchId && (
                  <p className="rounded-xl bg-surface-container-high px-3 py-2 text-[12px] text-on-surface-variant">
                    This batch is kept with its recordings and transcripts.{" "}
                    <Link href={clientVoicesBatchHref(batchId)} className="font-semibold text-primary hover:underline">
                      Open it
                    </Link>
                    .
                  </p>
                )}

                {/* Nothing was written down, so the page says so rather than leaving it to be assumed */}
                {isTemporary && tasks && (
                  <p className="rounded-xl bg-secondary-container px-3 py-2 text-[12px] text-on-secondary-container">
                    {CLIENT_VOICES_MESSAGES.notSaved}
                  </p>
                )}

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
