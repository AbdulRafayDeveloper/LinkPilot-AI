"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, Check, Loader2, RotateCcw } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import { requestApi } from "@/lib/apiClient"
import { formatInstant } from "@/lib/timeZone"
import { lostPlaceholders, withPlaceholdersBack } from "@/lib/promptPlaceholders"
import { canKeepalive } from "@/constants/textLimits"
import { PROMPT_MAX_LENGTH, PROMPT_MIN_LENGTH } from "@/constants/prompts"
import { ADMIN_PROMPTS_ENDPOINT, ADMIN_PROMPT_MESSAGES, PROMPT_AUTOSAVE_DELAY_MS } from "@/constants/adminPrompts"
import type { AdminPrompt } from "@/types/adminPrompts"

/**
 * One stored prompt, edited where it is read: its own text box that **saves itself** once typing
 * pauses (`PROMPT_AUTOSAVE_DELAY_MS`), with a copy button, Restore default and a line saying what
 * happened. Saves go one after another, so a quick second edit never lands before the first; Ctrl/⌘+S
 * saves at once; and an edit still waiting is sent when the card goes (another module chosen) or the
 * page closes, so nothing typed is lost.
 */

interface PromptEditorCardProps {
  prompt: AdminPrompt
  label: string
}

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: string } | { kind: "error"; message: string }

const urlOf = (key: string) => `${ADMIN_PROMPTS_ENDPOINT}/${encodeURIComponent(key)}`
const bodyOf = (prompt: string) => JSON.stringify({ prompt })

const putPrompt = (key: string, prompt: string) =>
  requestApi<AdminPrompt>(urlOf(key), { method: "PUT", headers: { "Content-Type": "application/json" }, body: bodyOf(prompt) }).then(({ data }) => data)

// What stops a text being saved, if anything: the server trims it and holds it to the same bounds
function problemWith(text: string): string | null {
  const length = text.trim().length
  if (length < PROMPT_MIN_LENGTH) return ADMIN_PROMPT_MESSAGES.tooShort(PROMPT_MIN_LENGTH)
  if (length > PROMPT_MAX_LENGTH) return ADMIN_PROMPT_MESSAGES.tooLong(PROMPT_MAX_LENGTH)
  return null
}

export const PromptEditorCard: React.FC<PromptEditorCardProps> = ({ prompt, label }) => {
  const [text, setText] = useState(prompt.prompt)
  // The copy the server last confirmed, which "changed" is measured against
  const [saved, setSaved] = useState(prompt)
  const [state, setState] = useState<SaveState>({ kind: "idle" })
  // Saves are chained so they reach the server in the order they were made
  const queue = useRef<Promise<void>>(Promise.resolve())
  // The text still waiting to be saved, for the card going away or the page closing
  const pending = useRef<string | null>(null)

  const problem = problemWith(text)
  // The server trims what it saves, so whitespace at the ends is never a change worth sending
  const isChanged = text.trim() !== saved.prompt.trim()

  useEffect(() => {
    pending.current = isChanged && !problem ? text : null
  }, [isChanged, problem, text])

  const key = prompt.key
  const save = useCallback((value: string) => {
    queue.current = queue.current.then(async () => {
      setState({ kind: "saving" })
      try {
        const confirmed = await putPrompt(key, value)
        setSaved(confirmed)
        setState({ kind: "saved", at: formatInstant(new Date(), { hour: "2-digit", minute: "2-digit" }) })
      } catch (error: unknown) {
        setState({ kind: "error", message: error instanceof Error ? error.message : ADMIN_PROMPT_MESSAGES.saveFailed })
      }
    })
  }, [key])

  // Saves itself once typing pauses
  useEffect(() => {
    if (!isChanged || problem) return
    const timer = window.setTimeout(() => save(text), PROMPT_AUTOSAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [text, isChanged, problem, save])

  // An edit still waiting is sent when the card goes, and with keepalive when the page closes
  useEffect(() => {
    const flushOnClose = () => {
      const value = pending.current
      if (value === null) return
      const body = bodyOf(value)
      void fetch(urlOf(key), { method: "PUT", headers: { "Content-Type": "application/json" }, body, keepalive: canKeepalive(body) }).catch(() => undefined)
    }
    window.addEventListener("pagehide", flushOnClose)
    return () => {
      window.removeEventListener("pagehide", flushOnClose)
      if (pending.current !== null) void putPrompt(key, pending.current).catch(() => undefined)
    }
  }, [key])

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault()
      if (isChanged && !problem) save(text)
    }
  }

  const isDefault = text.trim() === saved.defaultPrompt.trim()
  // A placeholder the original had is where the tool puts live data, and for some it is what turns a
  // feature on, so losing one in an edit is said at once rather than discovered as a missing feature
  const lost = lostPlaceholders(text, saved.defaultPrompt)
  const isCustom = !isDefault
  const fieldId = `prompt-${key}`

  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
      <header className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={fieldId} className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-on-surface">
            {label}
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                prompt.editable ? "bg-primary-fixed text-primary" : "bg-surface-container-high text-on-surface-variant"
              }`}
            >
              {prompt.editable ? ADMIN_PROMPT_MESSAGES.userBadge : ADMIN_PROMPT_MESSAGES.systemBadge}
            </span>
            {isCustom && (
              <span className="rounded-full bg-secondary-fixed px-2 py-0.5 text-[11px] font-semibold text-on-secondary-fixed-variant">
                {ADMIN_PROMPT_MESSAGES.customBadge}
              </span>
            )}
          </label>
          <p className="mt-0.5 truncate font-code text-[11px] text-outline" title={prompt.key}>
            {prompt.key}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isCustom && (
            <button
              type="button"
              onClick={() => setText(saved.defaultPrompt)}
              className="inline-flex min-h-6 items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
            >
              <RotateCcw size={13} aria-hidden="true" />
              {ADMIN_PROMPT_MESSAGES.restoreDefault}
            </button>
          )}
          <CopyButton text={text} label={`Copy ${label}`} showLabel />
        </div>
      </header>

      {lost.length > 0 && (
        <div role="alert" className="flex flex-wrap items-start gap-2 rounded-xl border border-secondary/40 bg-secondary-fixed px-3 py-2 text-[13px] text-on-secondary-fixed-variant">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">{ADMIN_PROMPT_MESSAGES.lostPlaceholders(lost.map((name) => `{{${name}}}`).join(", "))}</span>
          <button
            type="button"
            onClick={() => setText(withPlaceholdersBack(text, saved.defaultPrompt))}
            className="inline-flex min-h-6 shrink-0 items-center rounded-md border border-current px-2 py-0.5 text-[12px] font-semibold transition-colors hover:bg-surface-container-lowest/50"
          >
            {ADMIN_PROMPT_MESSAGES.putPlaceholdersBack}
          </button>
        </div>
      )}

      {prompt.description && (
        <p id={`${fieldId}-about`} className="rounded-xl bg-surface-container-low px-3 py-2 text-[13px] leading-relaxed text-on-surface-variant">
          {prompt.description}
        </p>
      )}

      <textarea
        id={fieldId}
        aria-describedby={prompt.description ? `${fieldId}-about` : undefined}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        spellCheck={false}
        rows={12}
        className="min-h-[220px] w-full resize-y rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 font-code text-[13px] leading-relaxed text-on-surface outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
      />

      <footer className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
        <SaveLine state={state} problem={problem} isChanged={isChanged} />
        <span className="text-outline">{ADMIN_PROMPT_MESSAGES.characters(text.length)}</span>
      </footer>
    </article>
  )
}

const SaveLine: React.FC<{ state: SaveState; problem: string | null; isChanged: boolean }> = ({ state, problem, isChanged }) => {
  if (state.kind === "saving") {
    return (
      <span role="status" className="inline-flex items-center gap-1.5 text-on-surface-variant">
        <Loader2 size={13} className="animate-spin text-primary" aria-hidden="true" />
        {ADMIN_PROMPT_MESSAGES.saving}
      </span>
    )
  }
  if (isChanged && problem) {
    return (
      <span role="status" className="inline-flex items-center gap-1.5 text-on-secondary-fixed-variant">
        <AlertTriangle size={13} aria-hidden="true" />
        {problem}
      </span>
    )
  }
  if (state.kind === "error") {
    return (
      <span role="alert" className="inline-flex items-center gap-1.5 text-error">
        <AlertTriangle size={13} aria-hidden="true" />
        {state.message}
      </span>
    )
  }
  if (isChanged) return <span className="text-on-surface-variant">{ADMIN_PROMPT_MESSAGES.unsaved}</span>
  if (state.kind === "saved") {
    return (
      <span role="status" className="inline-flex items-center gap-1.5 font-semibold text-success">
        <Check size={13} aria-hidden="true" />
        {ADMIN_PROMPT_MESSAGES.savedAt(state.at)}
      </span>
    )
  }
  return <span className="text-outline">{ADMIN_PROMPT_MESSAGES.autosaveNote}</span>
}
