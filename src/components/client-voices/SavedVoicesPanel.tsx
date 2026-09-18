"use client"

import React, { useEffect, useRef, useState } from "react"
import { AlertTriangle, Check, ListChecks, Loader2, Pencil, Play, RefreshCw, Trash2, X } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import { Modal } from "@/components/ui/Modal"
import { Pagination } from "@/components/ui/Pagination"
import { requestApi } from "@/lib/apiClient"
import { CLIENT_VOICES_ENDPOINT, CLIENT_VOICES_MESSAGES, VOICE_FILTERS, type VoiceFilterId } from "@/constants/clientVoices"
import type { ClientTask, SavedVoice, SavedVoicesPage, SavedVoiceTasks } from "@/types/clientVoices"

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
const sizeOf = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`)

/** The tasks a kept voice belongs to, editable in place. */
const TaskGroup: React.FC<{ group: SavedVoiceTasks; onSave: (tasks: ClientTask[]) => Promise<void> }> = ({ group, onSave }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const start = () => {
    setDraft(group.tasks.map((task) => task.task).join("\n"))
    setIsEditing(true)
  }

  const save = async () => {
    setIsSaving(true)
    const lines = draft.split("\n").map((line) => line.replace(/^[-*\d.\s]+/, "").trim()).filter(Boolean)
    // Keeping each task's voice numbers where the line still matches one, so nothing loses where it came from
    const tasks: ClientTask[] = lines.map((task, index) => ({ task, voices: group.tasks[index]?.voices ?? [] }))
    try {
      await onSave(tasks)
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-outline">
          <ListChecks size={13} className="text-primary" aria-hidden="true" />
          Tasks from these voices
        </p>
        <div className="flex items-center gap-1">
          <CopyButton text={group.tasks.map((task) => `- ${task.task}`).join("\n")} label="Copy these tasks" />
          {isEditing ? (
            <>
              <button type="button" onClick={() => void save()} disabled={isSaving} aria-label="Save the tasks" className="rounded-md p-1 text-primary hover:bg-surface-container-high disabled:opacity-50">
                {isSaving ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
              </button>
              <button type="button" onClick={() => setIsEditing(false)} aria-label="Stop editing" className="rounded-md p-1 text-outline hover:bg-surface-container-high">
                <X size={14} aria-hidden="true" />
              </button>
            </>
          ) : (
            <button type="button" onClick={start} aria-label="Edit these tasks" className="rounded-md p-1 text-outline hover:bg-surface-container-high hover:text-primary">
              <Pencil size={13} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      {isEditing ? (
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={Math.min(10, Math.max(3, draft.split("\n").length))}
          aria-label="The tasks, one per line"
          className="custom-scrollbar mt-1.5 w-full resize-none rounded-lg border border-outline-variant bg-white px-2.5 py-2 text-[12px] leading-relaxed text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
        />
      ) : (
        <ol className="mt-1 flex list-decimal flex-col gap-1 pl-4 text-[12px] leading-relaxed text-on-surface marker:text-outline">
          {group.tasks.map((task, index) => (
            <li key={`${index}-${task.task.slice(0, 20)}`}>
              {task.task}
              {task.voices.length > 0 && <span className="text-[11px] text-outline"> ({task.voices.map((voice) => `Voice ${voice}`).join(", ")})</span>}
            </li>
          ))}
        </ol>
      )}
      {group.editedAt && !isEditing && <p className="mt-1 text-[11px] text-outline">Edited by you</p>}
    </div>
  )
}

/**
 * Every voice kept for a client: play it, read what it said, see the tasks it went into (and reword
 * them), or delete it. The filter switches between the client chosen for the batch and every client.
 * A recording is played through a link made fresh for that click, so the bucket stays private.
 */
export const SavedVoicesPanel: React.FC<{
  clientId: string | null
  clientName: string | null
  reloadKey: number
}> = ({ clientId, clientName, reloadKey }) => {
  const [filter, setFilter] = useState<VoiceFilterId>("client")
  const [data, setData] = useState<SavedVoicesPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [answered, setAnswered] = useState<string | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<SavedVoice | null>(null)
  const [attempt, setAttempt] = useState(0)
  const audio = useRef<HTMLAudioElement | null>(null)
  // With no client chosen there is only one list to show, so the filter reads "All clients"
  const showing: VoiceFilterId = clientId ? filter : "all"
  const forClient = showing === "client" && clientId ? clientId : null

  // The page belongs to one list, so changing the filter or the client starts at the first page again
  const [paging, setPaging] = useState({ list: "", page: 1 })
  const list = `${showing}:${clientId ?? ""}`
  const page = paging.list === list ? paging.page : 1
  const setPage = (next: number) => setPaging({ list, page: next })

  const query = new URLSearchParams({ page: String(page), ...(forClient ? { clientId: forClient } : {}) }).toString()
  const requestKey = `${query}#${reloadKey}#${attempt}`
  const isLoading = answered !== requestKey

  useEffect(() => {
    // A newer request replaces the one on its way, so a slow answer never overwrites a newer one
    const controller = new AbortController()
    requestApi<SavedVoicesPage>(`${CLIENT_VOICES_ENDPOINT}/records?${query}`, { signal: controller.signal })
      .then(({ data: answer }) => {
        setData(answer)
        setError(null)
        // The server clamps a page past the end, and the pager follows it
        if (answer.page !== page) setPaging({ list, page: answer.page })
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : CLIENT_VOICES_MESSAGES.savedVoicesFailed)
      })
      .finally(() => {
        if (!controller.signal.aborted) setAnswered(requestKey)
      })
    return () => controller.abort()
  }, [query, requestKey, page, list])

  // The audio stops when the panel goes
  useEffect(() => () => audio.current?.pause(), [])

  const play = async (voice: SavedVoice) => {
    setError(null)
    try {
      audio.current?.pause()
      const { data } = await requestApi<{ url: string }>(`${CLIENT_VOICES_ENDPOINT}/records/${voice.id}/link`)
      const player = new Audio(data.url)
      audio.current = player
      player.onended = () => setPlaying(null)
      player.onerror = () => {
        setPlaying(null)
        setError(CLIENT_VOICES_MESSAGES.savedVoicesFailed)
      }
      await player.play()
      setPlaying(voice.id)
    } catch (reason: unknown) {
      setPlaying(null)
      setError(reason instanceof Error ? reason.message : CLIENT_VOICES_MESSAGES.savedVoicesFailed)
    }
  }

  const stop = () => {
    audio.current?.pause()
    setPlaying(null)
  }

  const remove = async (voice: SavedVoice) => {
    setDeleting(null)
    try {
      await requestApi(`${CLIENT_VOICES_ENDPOINT}/records/${voice.id}`, { method: "DELETE" })
      if (playing === voice.id) stop()
      setAttempt((count) => count + 1)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : CLIENT_VOICES_MESSAGES.deleteFailed)
    }
  }

  const saveTasks = async (group: SavedVoiceTasks, tasks: ClientTask[]) => {
    try {
      await requestApi<SavedVoiceTasks>(`${CLIENT_VOICES_ENDPOINT}/tasks/${group.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks }),
      })
      setAttempt((count) => count + 1)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : CLIENT_VOICES_MESSAGES.taskEditFailed)
      throw reason
    }
  }

  const groupOf = (voice: SavedVoice) => data?.taskGroups.find((group) => group.id === voice.taskGroupId) ?? null
  // The tasks are shown once, under the first voice of the batch they came from
  const isFirstOfGroup = (voice: SavedVoice, index: number) =>
    Boolean(voice.taskGroupId) && (data?.voices.findIndex((entry) => entry.taskGroupId === voice.taskGroupId) ?? -1) === index

  return (
    <section aria-label="Voices kept for clients" className="flex min-h-0 flex-col gap-3 rounded-2xl border border-outline-variant bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[14px] font-bold text-on-surface">Saved voices</h2>
          <p className="mt-0.5 text-[12px] text-on-surface-variant">
            {data ? `${data.total} kept${forClient && clientName ? ` for ${clientName}` : ""}` : "Every voice you keep with a client"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex rounded-lg border border-outline-variant p-0.5" role="group" aria-label="Which clients to show">
            {VOICE_FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilter(option.id)}
                disabled={option.id === "client" && !clientId}
                aria-pressed={showing === option.id}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  showing === option.id ? "bg-primary text-white" : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setAttempt((count) => count + 1)}
            aria-label="Read the list again"
            className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
          >
            <RefreshCw size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {isLoading && !data ? (
        <p role="status" className="flex items-center gap-2 py-6 text-[12px] text-on-surface-variant">
          <Loader2 size={14} className="animate-spin text-primary" aria-hidden="true" />
          Loading the saved voices...
        </p>
      ) : !data || data.voices.length === 0 ? (
        <p className="rounded-xl bg-surface-container-lowest px-3 py-6 text-center text-[12px] text-on-surface-variant">{CLIENT_VOICES_MESSAGES.noSavedVoices}</p>
      ) : (
        <ul className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
          {data.voices.map((voice, index) => (
            <li key={voice.id} className="flex flex-col gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-2.5">
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => (playing === voice.id ? stop() : void play(voice))}
                  aria-label={playing === voice.id ? `Stop ${voice.name}` : `Play ${voice.name}`}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
                    playing === voice.id ? "bg-primary text-white" : "bg-primary/10 text-primary hover:bg-primary/20"
                  }`}
                >
                  {playing === voice.id ? <X size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-on-surface">{voice.name}</p>
                  <p className="text-[11px] text-outline">
                    {voice.clientName} · Voice {voice.position} · {sizeOf(voice.size)} · {when(voice.createdAt)}
                  </p>
                </div>
                <CopyButton text={voice.transcript} label={`Copy what ${voice.name} said`} />
                <button
                  type="button"
                  onClick={() => setDeleting(voice)}
                  aria-label={`Delete ${voice.name}`}
                  className="shrink-0 rounded-md p-1 text-outline transition-colors hover:bg-error/5 hover:text-error"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
              {voice.transcript && <p className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-on-surface-variant">{voice.transcript}</p>}
              {isFirstOfGroup(voice, index) && groupOf(voice) && <TaskGroup group={groupOf(voice) as SavedVoiceTasks} onSave={(tasks) => saveTasks(groupOf(voice) as SavedVoiceTasks, tasks)} />}
            </li>
          ))}
        </ul>
      )}

      {data && data.totalPages > 1 && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} isLoading={isLoading} />}

      {deleting && (
        <Modal
          title="Delete this voice?"
          description={`${deleting.name} and what it said go for good. The tasks made from it stay.`}
          onClose={() => setDeleting(null)}
          size="compact"
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleting(null)} className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold hover:bg-surface-container-high">
                Cancel
              </button>
              <button type="button" onClick={() => void remove(deleting)} className="rounded-xl bg-error px-4 py-2 text-sm font-semibold text-white hover:bg-error/90">
                Delete voice
              </button>
            </div>
          }
        >
          <p className="text-sm text-on-surface-variant">This cannot be undone.</p>
        </Modal>
      )}
    </section>
  )
}
