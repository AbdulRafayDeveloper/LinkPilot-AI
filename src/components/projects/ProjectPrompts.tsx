"use client"

import React, { useEffect, useState } from "react"
import { Check, CheckCircle2, Circle, Loader2, Pencil, Trash2, X } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import { requestApi } from "@/lib/apiClient"
import { SAVED_OUTPUTS_ENDPOINT } from "@/constants/savedOutputs"
import { CREATED_NAME_MAX_LENGTH, CREATED_PROMPT_MAX_LENGTH } from "@/constants/promptCreator"
import { PROMPT_CREATOR_RECORD_ENDPOINT } from "@/constants/promptFolders"
import { PROMPT_PROJECTS_ENDPOINT, PROMPT_PROJECT_MESSAGES } from "@/constants/promptProjects"
import type { ProjectPrompt } from "@/types/promptProjects"

const inputClass =
  "w-full rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
const smallButton =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-outline-variant bg-white px-2.5 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"

/**
 * The prompts written in one project: each one read, marked used or not, copied, edited in place
 * and deleted. It moved here from the popup Prompt Creator used to manage projects in, unchanged,
 * so a prompt behaves the same wherever its project is opened.
 */
export const ProjectPrompts: React.FC<{ projectId: string; onDeleted: () => void }> = ({ projectId, onDeleted }) => {
  const [prompts, setPrompts] = useState<ProjectPrompt[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string; name: string; prompt: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    requestApi<{ prompts: ProjectPrompt[] }>(`${PROMPT_PROJECTS_ENDPOINT}/${projectId}/prompts`, { signal: controller.signal })
      .then(({ data }) => {
        setPrompts(data.prompts)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : PROMPT_PROJECT_MESSAGES.promptsFailed)
      })
    return () => controller.abort()
  }, [projectId])

  const savePrompt = async () => {
    if (!editing) return
    setBusy(editing.id)
    setError(null)
    try {
      const { data } = await requestApi<{ id: string; name: string; prompt: string }>(`${PROMPT_CREATOR_RECORD_ENDPOINT}/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editing.name, prompt: editing.prompt }),
      })
      setPrompts((current) => (current ?? []).map((entry) => (entry.id === data.id ? { ...entry, name: data.name, prompt: data.prompt } : entry)))
      setEditing(null)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : PROMPT_PROJECT_MESSAGES.promptsFailed)
    } finally {
      setBusy(null)
    }
  }

  /** Marks a prompt as one the user has used, or takes that mark off again. */
  const markApplied = async (prompt: ProjectPrompt) => {
    setBusy(prompt.id)
    setError(null)
    try {
      const { data } = await requestApi<{ id: string; appliedAt: string | null }>(`${PROMPT_CREATOR_RECORD_ENDPOINT}/${prompt.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applied: !prompt.appliedAt }),
      })
      setPrompts((current) => (current ?? []).map((entry) => (entry.id === data.id ? { ...entry, appliedAt: data.appliedAt } : entry)))
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : PROMPT_PROJECT_MESSAGES.promptsFailed)
    } finally {
      setBusy(null)
    }
  }

  const deletePrompt = async (id: string) => {
    setBusy(id)
    setError(null)
    try {
      await requestApi(`${SAVED_OUTPUTS_ENDPOINT}/prompt-creator/${id}`, { method: "DELETE" })
      setPrompts((current) => (current ?? []).filter((entry) => entry.id !== id))
      setConfirming(null)
      onDeleted()
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : PROMPT_PROJECT_MESSAGES.promptsFailed)
    } finally {
      setBusy(null)
    }
  }

  if (error && !prompts) {
    return (
      <p role="alert" className="px-3 py-2 text-[12px] text-error">
        {error}
      </p>
    )
  }
  if (!prompts) {
    return (
      <p role="status" className="flex items-center gap-2 px-3 py-2 text-[12px] text-on-surface-variant">
        <Loader2 size={13} className="animate-spin text-primary" aria-hidden="true" />
        Loading this project&apos;s prompts...
      </p>
    )
  }
  if (prompts.length === 0) return <p className="px-3 py-2 text-[12px] text-outline">No prompts written in this project yet.</p>

  return (
    <ul className="flex flex-col gap-2 px-3 pb-3">
      {error && (
        <li role="alert" className="text-[12px] text-error">
          {error}
        </li>
      )}
      {prompts.map((prompt) => (
        <li
          key={prompt.id}
          className={`rounded-lg border p-2.5 ${prompt.appliedAt ? "border-success/60 bg-success-container" : "border-outline-variant bg-white"}`}
        >
          {editing?.id === prompt.id ? (
            <div className="flex flex-col gap-2">
              <input
                value={editing.name}
                onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                maxLength={CREATED_NAME_MAX_LENGTH}
                aria-label="Prompt name"
                className={inputClass}
              />
              <textarea
                value={editing.prompt}
                onChange={(event) => setEditing({ ...editing, prompt: event.target.value })}
                maxLength={CREATED_PROMPT_MAX_LENGTH}
                rows={8}
                aria-label="Prompt text"
                className={`${inputClass} resize-y font-code text-[13px] leading-relaxed`}
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditing(null)} disabled={busy === prompt.id} className={smallButton}>
                  <X size={13} aria-hidden="true" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void savePrompt()}
                  disabled={busy === prompt.id || !editing.name.trim() || !editing.prompt.trim()}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-on-primary-fixed-variant disabled:opacity-60"
                >
                  {busy === prompt.id ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Check size={13} aria-hidden="true" />}
                  Save prompt
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-on-surface">{prompt.name}</p>
                <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-on-surface-variant">{prompt.prompt}</p>
                <p className="mt-1 text-[11px] text-outline">
                  {new Date(prompt.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                  {prompt.editedAt && " · Edited by hand"}
                  {prompt.appliedAt && (
                    <span className="font-semibold text-on-success-container">
                      {" · Applied "}
                      {new Date(prompt.appliedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => void markApplied(prompt)}
                  disabled={busy === prompt.id}
                  aria-pressed={Boolean(prompt.appliedAt)}
                  aria-label={prompt.appliedAt ? `Mark "${prompt.name}" as not used` : `Mark "${prompt.name}" as used`}
                  title={prompt.appliedAt ? "Used. Click to take the mark off" : "Mark as used"}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
                    prompt.appliedAt ? "text-success hover:bg-success/25" : "text-outline hover:bg-surface-container-high hover:text-success"
                  }`}
                >
                  {busy === prompt.id ? (
                    <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  ) : prompt.appliedAt ? (
                    <CheckCircle2 size={15} aria-hidden="true" />
                  ) : (
                    <Circle size={15} aria-hidden="true" />
                  )}
                </button>
                <CopyButton text={prompt.prompt} label={`Copy "${prompt.name}"`} />
                <button
                  type="button"
                  onClick={() => setEditing({ id: prompt.id, name: prompt.name, prompt: prompt.prompt })}
                  aria-label={`Edit "${prompt.name}"`}
                  title="Edit"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
                {confirming === prompt.id ? (
                  <button
                    type="button"
                    onClick={() => void deletePrompt(prompt.id)}
                    disabled={busy === prompt.id}
                    onBlur={() => setConfirming(null)}
                    className="whitespace-nowrap rounded-lg bg-error px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-error/90 disabled:opacity-60"
                  >
                    {busy === prompt.id ? "Deleting..." : "Delete prompt"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(prompt.id)}
                    aria-label={`Delete "${prompt.name}"`}
                    title="Delete"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-outline hover:bg-error/10 hover:text-error"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
