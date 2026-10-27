"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeft, AudioLines, HelpCircle, ListChecks, Loader2, Mic, Pencil, RefreshCw, Trash2, Users, X } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { ConfirmBulkDelete } from "@/components/ui/BulkDelete"
import { TaskListPanel } from "@/components/client-voices/TaskListPanel"
import { QuestionListPanel } from "@/components/client-voices/QuestionListPanel"
import { KeptVoiceList } from "@/components/client-voices/KeptVoiceList"
import { ListEditor, type ListEntry } from "@/components/client-voices/ListEditor"
import { AiSourceLabel } from "@/components/ui/AiSourceLabel"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { requestApi } from "@/lib/apiClient"
import {
  BATCH_TITLE_MAX_LENGTH,
  CLEAR_POINTS_MAX,
  CLIENT_VOICES_ENDPOINT,
  CLIENT_VOICES_HISTORY_HREF,
  CLIENT_VOICES_MESSAGES,
  VOICE_BATCHES_ENDPOINT,
} from "@/constants/clientVoices"
import { describeSource } from "@/constants/aiProviders"
import type { SavedVoice, VoiceBatchDetail } from "@/types/clientVoices"
import { formatInstant } from "@/lib/timeZone"

const runOn = (iso: string) =>
  formatInstant(iso, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })

const backButton =
  "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold text-outline transition-colors hover:bg-surface-container hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
const pagerButton =
  "inline-flex items-center gap-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
const headerButton =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
const panel = "flex flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm"

/**
 * What is being reworded: the batch's name, both of its lists, and what each voice said, word for
 * word and in clear points. The points are written as lines, which is how they read and how anyone
 * would edit them; they become a list again on the way back.
 */
interface Draft {
  title: string
  tasks: ListEntry[]
  questions: ListEntry[]
  transcripts: Record<string, string>
  clear: Record<string, string>
}

const draftOf = (batch: VoiceBatchDetail): Draft => ({
  title: batch.title,
  tasks: batch.tasks.map((task) => ({ text: task.task, voices: task.voices })),
  questions: batch.questions.map((entry) => ({ text: entry.question, voices: entry.voices })),
  transcripts: Object.fromEntries(batch.voices.map((voice) => [voice.id, voice.transcript])),
  clear: Object.fromEntries(batch.voices.map((voice) => [voice.id, voice.clearPoints.join("\n")])),
})

// One point per line, and a line with nothing on it is not a point
const pointsOf = (text: string) =>
  text
    .split("\n")
    .map((line) => line.replace(/^[-*•\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, CLEAR_POINTS_MAX)

// A line left empty is one the user meant to take out, so it never reaches the server as a blank
const written = (entries: ListEntry[]) => entries.filter((entry) => entry.text.trim().length > 0)

/**
 * One kept batch of client voice messages, in full: when it was run and whose it was, the work it
 * asked for, the questions it asked, and every voice it was made from with its recording to play
 * and its transcript to read.
 *
 * **Everything written here can be reworded**, at the owner's request: the batch's name, either
 * list, and what each voice said. Nothing here adds a voice, because a voice is a recording that
 * really arrived; what is edited is only ever the words the app wrote down from one. **One Edit
 * opens the whole page and one Save writes it**, rather than a pencil per panel, so a batch is
 * never left half changed and the page is never half in one mode.
 *
 * Everything comes from one request, signed links included, so pressing play asks for nothing. The
 * links expire, so the answer is never cached and reading the page again signs new ones.
 */
export default function BatchDetailClient({ batchId }: { batchId: string }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const router = useRouter()
  const [batch, setBatch] = useState<VoiceBatchDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmingBatch, setConfirmingBatch] = useState(false)
  const [isDeletingBatch, setIsDeletingBatch] = useState(false)
  const [deletingVoice, setDeletingVoice] = useState<SavedVoice | null>(null)
  const [voiceOnItsWay, setVoiceOnItsWay] = useState<string | null>(null)
  // Null while the batch is only being read; what is being written otherwise
  const [draft, setDraft] = useState<Draft | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    requestApi<VoiceBatchDetail>(`${VOICE_BATCHES_ENDPOINT}/${batchId}`, { signal: controller.signal })
      .then(({ data }) => {
        setBatch(data)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : CLIENT_VOICES_MESSAGES.historyFailed)
      })
    return () => controller.abort()
  }, [batchId, attempt])

  /**
   * Writes the draft: the batch's own fields in one call, then every transcript that really
   * changed, so an untouched voice is never written to. The page is read again afterwards, which
   * also signs fresh links for the players.
   */
  const save = async () => {
    if (!batch || !draft || isSaving) return
    setIsSaving(true)
    setNotice(null)
    try {
      await requestApi(`${VOICE_BATCHES_ENDPOINT}/${batchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title.trim(),
          tasks: written(draft.tasks).map((entry) => ({ task: entry.text.trim(), voices: entry.voices })),
          questions: written(draft.questions).map((entry) => ({ question: entry.text.trim(), voices: entry.voices })),
        }),
      })
      for (const voice of batch.voices) {
        const transcript = draft.transcripts[voice.id] ?? ""
        const points = pointsOf(draft.clear[voice.id] ?? "")
        const changed = {
          ...(transcript !== voice.transcript ? { transcript } : {}),
          ...(points.join("\n") !== voice.clearPoints.join("\n") ? { clearPoints: points } : {}),
        }
        // Only what the user really changed, so an untouched voice is never written to
        if (Object.keys(changed).length === 0) continue
        await requestApi(`${CLIENT_VOICES_ENDPOINT}/records/${voice.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changed),
        })
      }
      setDraft(null)
      setAttempt((count) => count + 1)
    } catch (reason: unknown) {
      setNotice(reason instanceof Error ? reason.message : CLIENT_VOICES_MESSAGES.editFailed)
    } finally {
      setIsSaving(false)
    }
  }

  /** The whole batch, with its recordings and transcripts. Final, so only ever from the confirmation. */
  const deleteBatch = async () => {
    if (isDeletingBatch) return
    setIsDeletingBatch(true)
    setNotice(null)
    try {
      await requestApi<{ deleted: number }>(`${VOICE_BATCHES_ENDPOINT}/${batchId}`, { method: "DELETE" })
      router.push(CLIENT_VOICES_HISTORY_HREF)
    } catch (reason: unknown) {
      setNotice(reason instanceof Error ? reason.message : CLIENT_VOICES_MESSAGES.deleteBatchFailed)
      setConfirmingBatch(false)
    } finally {
      setIsDeletingBatch(false)
    }
  }

  /** One voice out of the batch. What it asked for stays in the lists, which were already written. */
  const deleteVoice = async (voice: SavedVoice) => {
    setVoiceOnItsWay(voice.id)
    setNotice(null)
    try {
      await requestApi<{ deleted: number }>(`${CLIENT_VOICES_ENDPOINT}/records/${voice.id}`, { method: "DELETE" })
      setBatch((current) => (current ? { ...current, voices: current.voices.filter((entry) => entry.id !== voice.id) } : current))
      setDeletingVoice(null)
    } catch (reason: unknown) {
      setNotice(reason instanceof Error ? reason.message : CLIENT_VOICES_MESSAGES.deleteFailed)
      setDeletingVoice(null)
    } finally {
      setVoiceOnItsWay(null)
    }
  }

  const writtenOut = batch ? batch.voices.filter((voice) => voice.transcript).length : 0

  return (
    <div className="font-body-md text-body-md flex h-screen min-h-screen overflow-hidden bg-background text-on-surface">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setIsSidebarOpen(true)} isSidebarCollapsed={isCollapsed} onToggleCollapse={toggleCollapsed} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <div className="mx-auto flex max-w-[1100px] flex-col gap-4 p-4 md:p-6 lg:p-8">
            <Link href={CLIENT_VOICES_HISTORY_HREF} className={`${backButton} self-start`}>
              <ArrowLeft size={14} aria-hidden="true" />
              All saved batches
            </Link>

            {error && !batch ? (
              <div role="alert" className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <AlertTriangle size={20} className="text-error" aria-hidden="true" />
                <p className="max-w-sm text-sm text-on-surface-variant">{error}</p>
                <button type="button" onClick={() => setAttempt((count) => count + 1)} className={pagerButton}>
                  <RefreshCw size={14} aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : !batch ? (
              <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-on-surface-variant">
                <Loader2 size={20} className="animate-spin text-primary" aria-hidden="true" />
                Loading this batch...
              </div>
            ) : (
              <>
                <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
                  <div className="min-w-0 flex-1">
                    {draft ? (
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-outline">{CLIENT_VOICES_MESSAGES.title}</span>
                        <input
                          value={draft.title}
                          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                          maxLength={BATCH_TITLE_MAX_LENGTH}
                          placeholder={CLIENT_VOICES_MESSAGES.titlePlaceholder}
                          className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-lg font-bold text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                        />
                      </label>
                    ) : (
                      <h1 className="flex items-center gap-2 text-2xl font-bold text-on-surface">
                        <AudioLines size={24} className="shrink-0 text-primary" aria-hidden="true" />
                        <span className="min-w-0 break-words">{batch.title || batch.clientName || CLIENT_VOICES_MESSAGES.untitled}</span>
                      </h1>
                    )}
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-on-surface-variant">
                      <span>{runOn(batch.createdAt)}</span>
                      {batch.clientName && (
                        <span className="inline-flex items-center gap-1">
                          <Users size={13} className="text-outline" aria-hidden="true" />
                          {batch.clientName}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Mic size={13} className="text-outline" aria-hidden="true" />
                        {batch.voiceCount} {batch.voiceCount === 1 ? "voice" : "voices"}, {writtenOut} written out
                      </span>
                      {/* The gap between the spans is the separator here, so the label needs no dot of its own */}
                      {describeSource(batch) && <AiSourceLabel source={batch} prefix="" />}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 xl:shrink-0">
                    {draft ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void save()}
                          disabled={isSaving}
                          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSaving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                          {CLIENT_VOICES_MESSAGES.save}
                        </button>
                        <button type="button" onClick={() => setDraft(null)} disabled={isSaving} className={headerButton}>
                          <X size={16} aria-hidden="true" />
                          {CLIENT_VOICES_MESSAGES.cancel}
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => setDraft(draftOf(batch))} className={headerButton}>
                          <Pencil size={16} aria-hidden="true" />
                          {CLIENT_VOICES_MESSAGES.edit}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingBatch(true)}
                          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-error/40 bg-surface-container-lowest px-4 py-2.5 text-sm font-semibold text-error transition-colors hover:bg-error-container"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                          Delete batch
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {notice && (
                  <p role="alert" className="rounded-xl border border-error/40 bg-error-container px-3 py-2 text-[12px] text-error">
                    {notice}
                  </p>
                )}

                {batch.editedAt && !draft && <p className="text-[11px] text-outline">You reworded this batch on {runOn(batch.editedAt)}.</p>}

                {/* What came out of the batch first, since that is what it was run for, then the
                    voices it came from. Side by side from lg, where both lists have room to read */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {draft ? (
                    <>
                      <section className={panel}>
                        <h2 className="flex items-center gap-2 text-sm font-bold text-on-surface">
                          <ListChecks size={16} className="text-primary" aria-hidden="true" />
                          What the client asked for
                        </h2>
                        <ListEditor
                          entries={draft.tasks}
                          onChange={(tasks) => setDraft({ ...draft, tasks })}
                          noun="task"
                          addLabel={CLIENT_VOICES_MESSAGES.addTask}
                          emptyLabel="Nothing is on this list yet."
                        />
                      </section>
                      <section className={panel}>
                        <h2 className="flex items-center gap-2 text-sm font-bold text-on-surface">
                          <HelpCircle size={16} className="text-primary" aria-hidden="true" />
                          What the client asked
                        </h2>
                        <ListEditor
                          entries={draft.questions}
                          onChange={(questions) => setDraft({ ...draft, questions })}
                          noun="question"
                          addLabel={CLIENT_VOICES_MESSAGES.addQuestion}
                          emptyLabel={CLIENT_VOICES_MESSAGES.questionsEmpty}
                        />
                      </section>
                    </>
                  ) : (
                    <>
                      {/* The header line already says which model wrote both lists, so the panel does not repeat it */}
                      <TaskListPanel result={{ tasks: batch.tasks, missingVoices: batch.missingVoices }} isWorking={false} error={null} />
                      <QuestionListPanel questions={batch.questions} isWorking={false} />
                    </>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <h2 className="text-[10px] font-bold uppercase tracking-wider text-outline">The voices this came from, with their transcripts</h2>
                  {batch.voices.length === 0 ? (
                    <p className="rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-6 text-center text-[12px] text-on-surface-variant">
                      No recordings are kept for this batch.
                    </p>
                  ) : (
                    <KeptVoiceList
                      voices={batch.voices}
                      deletingId={voiceOnItsWay}
                      onDelete={setDeletingVoice}
                      editing={
                        draft
                          ? {
                              transcriptOf: (id) => draft.transcripts[id] ?? "",
                              onTranscript: (id, text) => setDraft({ ...draft, transcripts: { ...draft.transcripts, [id]: text } }),
                              clearOf: (id) => draft.clear[id] ?? "",
                              onClear: (id, text) => setDraft({ ...draft, clear: { ...draft.clear, [id]: text } }),
                            }
                          : undefined
                      }
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {confirmingBatch && (
        <ConfirmBulkDelete
          count={1}
          noun={{ one: "batch", many: "batches" }}
          alsoGoes={CLIENT_VOICES_MESSAGES.confirmDeleteBatch}
          isDeleting={isDeletingBatch}
          onConfirm={() => void deleteBatch()}
          onClose={() => setConfirmingBatch(false)}
        />
      )}

      {deletingVoice && (
        <ConfirmBulkDelete
          count={1}
          noun={{ one: "voice", many: "voices" }}
          alsoGoes="Its recording and its transcript go. What it asked for stays in the lists above."
          isDeleting={voiceOnItsWay === deletingVoice.id}
          onConfirm={() => void deleteVoice(deletingVoice)}
          onClose={() => setDeletingVoice(null)}
        />
      )}
    </div>
  )
}
