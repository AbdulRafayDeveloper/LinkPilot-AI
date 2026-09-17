"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AlertTriangle, ArrowUp, Bot, Loader2, Maximize2, MessageSquare, Minimize2, Square, Trash2, User } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { requestApi } from "@/lib/apiClient"
import { readSSEStream } from "@/lib/sse"
import { MEETING_CHAT_MESSAGES, MEETING_PLANNER_ENDPOINT_CHAT, QUESTION_MAX_LENGTH } from "@/constants/meetingChat"
import { AI_PROVIDER_LABELS, type AiProviderId } from "@/constants/aiProviders"
import type { MeetingChatEvent, MeetingChatHistory, MeetingChatMessage } from "@/types/meetingChat"

// What the page shows while the answer is still arriving
const STREAMING_ID = "streaming"

const Bubble: React.FC<{ message: MeetingChatMessage; isStreaming?: boolean }> = ({ message, isStreaming = false }) => {
  const isYou = message.role === "you"
  return (
    <li className={`flex gap-2 ${isYou ? "flex-row-reverse" : ""}`}>
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isYou ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant"}`}
        aria-hidden="true"
      >
        {isYou ? <User size={14} /> : <Bot size={14} />}
      </span>
      <div className={`flex min-w-0 max-w-[85%] flex-col gap-1 ${isYou ? "items-end" : "items-start"}`}>
        <div
          className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed ${
            isYou ? "bg-primary text-white" : "bg-surface-container-lowest text-on-surface ring-1 ring-outline-variant"
          }`}
        >
          {message.text}
          {isStreaming && <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse bg-primary align-middle" aria-hidden="true" />}
        </div>
        {!isYou && !isStreaming && (
          <p className="px-1 text-[11px] text-outline">
            {message.fromMeeting ? `From this meeting: ${message.sources.slice(0, 3).join(", ")}` : "Not in the meeting notes, answered from general knowledge"}
            {message.provider && ` · ${AI_PROVIDER_LABELS[message.provider as AiProviderId] ?? message.provider}`}
          </p>
        )}
      </div>
    </li>
  )
}

/**
 * Ask this meeting: a chat that answers from the meeting's own vectors (services/meetingPlanner).
 * The answer is written as it arrives, the chat is kept with the meeting, and Expand shows it on the
 * whole screen for a long read. What an answer was read from is named under it, and an answer the
 * meeting could not supply says so rather than passing itself off as part of the preparation.
 */
export const MeetingChatPanel: React.FC<{ meetingId: string; meetingName: string; personName: string | null }> = ({ meetingId, meetingName, personName }) => {
  const [messages, setMessages] = useState<MeetingChatMessage[]>([])
  const [pieces, setPieces] = useState<number | null>(null)
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isClearOpen, setIsClearOpen] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const endpoint = `${MEETING_PLANNER_ENDPOINT_CHAT(meetingId)}`
  const isAnswering = answer !== null

  useEffect(() => {
    const controller = new AbortController()
    requestApi<MeetingChatHistory>(endpoint, { signal: controller.signal })
      .then(({ data }) => {
        setMessages(data.messages)
        setPieces(data.pieces)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : MEETING_CHAT_MESSAGES.historyFailed)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [endpoint])

  // Follow the answer as it is written, and every new message
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" })
  }, [messages, answer])

  useEffect(() => () => abort.current?.abort(), [])

  const ask = useCallback(
    async (text: string) => {
      const asked = text.trim()
      if (!asked || isAnswering) return
      const controller = new AbortController()
      abort.current = controller
      setQuestion("")
      setError(null)
      setAnswer("")
      setMessages((current) => [...current, { id: `you-${Date.now()}`, role: "you", text: asked, sources: [], fromMeeting: false, provider: null, createdAt: new Date().toISOString() }])
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: asked }),
          signal: controller.signal,
        })
        if (!response.ok || !response.body) {
          const failed = await response.json().catch(() => null)
          throw new Error(failed?.message || MEETING_CHAT_MESSAGES.answerFailed)
        }
        let streamed = ""
        await readSSEStream<MeetingChatEvent>(response.body, (event) => {
          if (event.status === "TOKEN") {
            streamed += event.text
            setAnswer(streamed)
          } else if (event.status === "COMPLETE") {
            setMessages((current) => [...current, event.message])
            setAnswer(null)
          } else if (event.status === "ERROR") {
            setError(event.message)
            setAnswer(null)
          }
        })
      } catch (reason: unknown) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : MEETING_CHAT_MESSAGES.answerFailed)
      } finally {
        if (abort.current === controller) abort.current = null
        setAnswer((current) => (current === null ? null : null))
      }
    },
    [endpoint, isAnswering]
  )

  const stop = () => {
    abort.current?.abort()
    abort.current = null
    setAnswer(null)
  }

  const clear = async () => {
    try {
      const { data } = await requestApi<MeetingChatHistory>(endpoint, { method: "DELETE" })
      setMessages(data.messages)
      setPieces(data.pieces)
      setIsClearOpen(false)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : MEETING_CHAT_MESSAGES.clearFailed)
      setIsClearOpen(false)
    }
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void ask(question)
    }
  }

  // Escape leaves the expanded view rather than the page
  useEffect(() => {
    if (!isExpanded) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsExpanded(false)
    }
    window.addEventListener("keydown", onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [isExpanded])

  const chat = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-on-surface">
            <MessageSquare size={16} className="shrink-0 text-primary" aria-hidden="true" />
            Ask this meeting
          </h2>
          <p className="mt-0.5 text-[12px] text-on-surface-variant">
            Answers from everything saved on {personName || meetingName}
            {pieces ? ` · ${pieces} pieces searched` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setIsClearOpen(true)}
              aria-label="Clear this chat"
              title="Clear this chat"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-error"
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            aria-label={isExpanded ? "Leave the big chat" : "Open the chat big"}
            title={isExpanded ? "Leave the big chat (Escape)" : "Open the chat big"}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
          >
            {isExpanded ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div ref={list} className={`custom-scrollbar flex-1 overflow-y-auto rounded-xl bg-surface-container-lowest/60 p-3 ${isExpanded ? "" : "max-h-[420px] min-h-[220px]"}`}>
        {isLoading ? (
          <p role="status" className="flex items-center gap-2 py-6 text-[13px] text-on-surface-variant">
            <Loader2 size={15} className="animate-spin text-primary" aria-hidden="true" />
            Loading the chat...
          </p>
        ) : messages.length === 0 && !isAnswering ? (
          <p className="py-6 text-center text-[13px] text-on-surface-variant">{pieces === 0 ? MEETING_CHAT_MESSAGES.notReady : MEETING_CHAT_MESSAGES.emptyChat}</p>
        ) : (
          <ul className="flex flex-col gap-3" aria-label="The chat about this meeting" aria-live="polite">
            {messages.map((message) => (
              <Bubble key={message.id} message={message} />
            ))}
            {isAnswering && (
              <Bubble
                isStreaming
                message={{ id: STREAMING_ID, role: "assistant", text: answer || "Reading the meeting...", sources: [], fromMeeting: false, provider: null, createdAt: "" }}
              />
            )}
          </ul>
        )}
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-error-container px-3 py-2 text-[12px] text-error">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={input}
          value={question}
          onChange={(event) => setQuestion(event.target.value.slice(0, QUESTION_MAX_LENGTH))}
          onKeyDown={onKeyDown}
          rows={isExpanded ? 2 : 1}
          placeholder="Ask anything about this meeting..."
          aria-label="Your question about this meeting"
          className="custom-scrollbar max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-outline-variant bg-white px-3 py-2.5 text-[14px] text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
        />
        {isAnswering ? (
          <button
            type="button"
            onClick={stop}
            aria-label="Stop the answer"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-outline-variant bg-white text-on-surface-variant transition-colors hover:bg-surface-container-high"
          >
            <Square size={15} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void ask(question)}
            disabled={!question.trim()}
            aria-label="Ask"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowUp size={17} aria-hidden="true" />
          </button>
        )}
      </div>
    </>
  )

  return (
    <>
      <section aria-label="Ask this meeting" className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-white p-5 shadow-sm">
        {!isExpanded && chat}
        {isExpanded && (
          <p className="flex items-center gap-2 py-2 text-[13px] text-on-surface-variant">
            <MessageSquare size={15} className="text-primary" aria-hidden="true" />
            The chat is open on the whole screen.
          </p>
        )}
      </section>

      {isExpanded &&
        createPortal(
          <div role="dialog" aria-modal="true" aria-label={`Ask this meeting: ${meetingName}`} className="fixed inset-0 z-[80] flex flex-col gap-3 bg-background p-3 sm:p-5">
            {chat}
          </div>,
          document.body
        )}

      {isClearOpen && (
        <Modal
          title="Clear this chat?"
          description="The questions and answers go. The meeting, its preparation and what the chat reads from stay as they are."
          onClose={() => setIsClearOpen(false)}
          size="compact"
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsClearOpen(false)} className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold hover:bg-surface-container-high">
                Cancel
              </button>
              <button type="button" onClick={() => void clear()} className="rounded-xl bg-error px-4 py-2 text-sm font-semibold text-white hover:bg-error/90">
                Clear chat
              </button>
            </div>
          }
        >
          <p className="text-sm text-on-surface-variant">This cannot be undone.</p>
        </Modal>
      )}
    </>
  )
}
