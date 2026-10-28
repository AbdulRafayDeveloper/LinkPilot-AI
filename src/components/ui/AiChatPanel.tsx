"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AlertTriangle, ArrowUp, Bot, Loader2, Maximize2, Mic, Minimize2, Sparkles, Square, Trash2, User, type LucideIcon } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { CopyButton } from "@/components/ui/CopyButton"
import { RichTextView } from "@/components/ui/RichTextView"
import { VoiceRecorder } from "@/components/ui/VoiceRecorder"
import { requestApi } from "@/lib/apiClient"
import { appendSpokenText } from "@/lib/spokenText"
import { readSSEStream } from "@/lib/sse"
import { AI_CHAT_MESSAGES } from "@/constants/aiChat"
import { VOICE_MESSAGES } from "@/constants/voiceInput"
import { AI_PROVIDER_LABELS, type AiProviderId } from "@/constants/aiProviders"
import type { VoiceModuleId } from "@/constants/modelPriority"
import type { AiChatEvent, AiChatMessage } from "@/types/chat"

interface BubbleProps {
  role: AiChatMessage["role"]
  text: string
  provider?: string | null
  // The line under an answer: what it was read from
  note?: string
  isStreaming?: boolean
}

const Bubble: React.FC<BubbleProps> = ({ role, text, provider = null, note, isStreaming = false }) => {
  const isYou = role === "you"
  return (
    <li className={`flex gap-2 ${isYou ? "flex-row-reverse" : ""}`}>
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isYou ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant"}`}
        aria-hidden="true"
      >
        {isYou ? <User size={14} /> : <Bot size={14} />}
      </span>
      {/* An answer with headings and lists needs the room to lay them out; a question never does */}
      <div className={`group flex min-w-0 flex-col gap-1 ${isYou ? "max-w-[min(85%,720px)] items-end" : "max-w-[min(92%,920px)] items-start"}`}>
        <div
          className={`break-words rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed ${
            isYou ? "whitespace-pre-wrap bg-primary text-white" : "bg-surface-container-lowest text-on-surface ring-1 ring-outline-variant"
          }`}
        >
          {isYou ? (
            text
          ) : (
            <>
              {/* Headings, bold, italics, bullets, numbered steps and links are shown as formatting,
                  not as the marks around them. A heading gets air above it so the parts of a long
                  answer read as separate sections, and the first one never pushes the bubble open. */}
              <RichTextView text={text} className="!gap-2 !text-[14px] !text-on-surface [&>h3]:mt-1.5 [&>h4]:mt-1.5 [&>h5]:mt-1.5 [&>*:first-child]:!mt-0" />
              {isStreaming && <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse bg-primary align-middle" aria-hidden="true" />}
            </>
          )}
        </div>
        {!isStreaming && (
          <div className={`flex items-center gap-1.5 px-1 ${isYou ? "flex-row-reverse" : ""}`}>
            <CopyButton text={text} label={isYou ? "Copy your question" : "Copy this answer"} />
            {!isYou && note && (
              // Which model wrote it is in the tooltip rather than on the line, to keep the chat plain
              <p className="text-[11px] text-outline" title={provider ? `Answered by ${AI_PROVIDER_LABELS[provider as AiProviderId] ?? provider}` : undefined}>
                {note}
              </p>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

export interface AiChatPanelProps<M extends AiChatMessage, H> {
  // Where the chat lives: GET its history, POST a question (answered as Server-Sent Events), DELETE to clear it
  endpoint: string
  // The module whose provider order reads a spoken question
  transcribeFor: VoiceModuleId
  title: string
  icon: LucideIcon
  subtitle: string
  // The history as the endpoint answers it, read into the messages and whether there is anything to answer from
  readHistory: (history: H) => { messages: M[]; isReady: boolean }
  // The question as it shows until the server has kept it
  questionMessage: (text: string) => M
  // The line under an answer, saying what it was read from
  describeAnswer: (message: M) => string
  emptyText: string
  // Said instead of `emptyText` while the chat has nothing to answer from
  notReadyText?: string
  // What the answer bubble says until its first words arrive
  pendingText: string
  placeholder: string
  inputLabel: string
  clearDescription: string
  maxQuestionLength: number
  // Questions offered on an empty chat, asked with one click
  suggestions?: readonly string[]
  // A chat that is the whole page rather than one panel on it gets more room
  tall?: boolean
  /**
   * The chat is the page: it grows to fill the room its parent gives it (a flex column), and only its
   * list of messages scrolls, never below a readable height. Finance Bot passes it.
   */
  fill?: boolean
}

/**
 * A chat with an AI that answers from something of the person's own: a meeting, their profile. The
 * answer is written as it arrives, the chat is kept on the server, a question can be typed or spoken,
 * every message can be copied, and Expand shows the chat on the whole screen for a long read. What an
 * answer was read from is named under it.
 *
 * Every chat in the app is this one component, so how a chat behaves is written once; what differs
 * (where it lives, which module reads the speech, the words on the page) comes in as props.
 */
export function AiChatPanel<M extends AiChatMessage, H>({
  endpoint,
  transcribeFor,
  title,
  icon: Icon,
  subtitle,
  readHistory,
  questionMessage,
  describeAnswer,
  emptyText,
  notReadyText,
  pendingText,
  placeholder,
  inputLabel,
  clearDescription,
  maxQuestionLength,
  suggestions = [],
  tall = false,
  fill = false,
}: AiChatPanelProps<M, H>) {
  const [messages, setMessages] = useState<M[]>([])
  const [isReady, setIsReady] = useState(true)
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isClearOpen, setIsClearOpen] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  // Read through a ref, so a caller passing a new function each render never reloads the chat
  const read = useRef(readHistory)
  useEffect(() => {
    read.current = readHistory
  }, [readHistory])
  const isAnswering = answer !== null

  useEffect(() => {
    const controller = new AbortController()
    requestApi<H>(endpoint, { signal: controller.signal })
      .then(({ data }) => {
        const history = read.current(data)
        setMessages(history.messages)
        setIsReady(history.isReady)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : AI_CHAT_MESSAGES.historyFailed)
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
      setMessages((current) => [...current, questionMessage(asked)])
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: asked }),
          signal: controller.signal,
        })
        if (!response.ok || !response.body) {
          const failed = await response.json().catch(() => null)
          throw new Error(failed?.message || AI_CHAT_MESSAGES.answerFailed)
        }
        let streamed = ""
        await readSSEStream<AiChatEvent<M>>(response.body, (event) => {
          if (event.status === "TOKEN") {
            streamed += event.text
            setAnswer(streamed)
          } else if (event.status === "COMPLETE") {
            setMessages((current) => [...current, event.message])
            setIsReady(true)
            setAnswer(null)
          } else if (event.status === "ERROR") {
            setError(event.message)
            setAnswer(null)
          }
        })
      } catch (reason: unknown) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : AI_CHAT_MESSAGES.answerFailed)
      } finally {
        if (abort.current === controller) abort.current = null
        setAnswer(null)
      }
    },
    [endpoint, isAnswering, questionMessage]
  )

  const stop = () => {
    abort.current?.abort()
    abort.current = null
    setAnswer(null)
  }

  const clear = async () => {
    try {
      const { data } = await requestApi<H>(endpoint, { method: "DELETE" })
      const history = read.current(data)
      setMessages(history.messages)
      setIsReady(history.isReady)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : AI_CHAT_MESSAGES.clearFailed)
    } finally {
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

  const listSize = isExpanded ? "" : fill ? "min-h-[300px] max-h-[70vh] lg:max-h-none lg:basis-0" : tall ? "h-[min(62vh,680px)] min-h-[320px]" : "max-h-[420px] min-h-[220px]"
  const isEmpty = messages.length === 0 && !isAnswering

  const chat = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-on-surface">
            <Icon size={16} className="shrink-0 text-primary" aria-hidden="true" />
            {title}
          </h2>
          <p className="mt-0.5 text-[12px] text-on-surface-variant">{subtitle}</p>
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

      <div ref={list} className={`custom-scrollbar flex-1 overflow-y-auto rounded-xl bg-surface-container-lowest/60 p-3 ${listSize}`}>
        {isLoading ? (
          <p role="status" className="flex items-center gap-2 py-6 text-[13px] text-on-surface-variant">
            <Loader2 size={15} className="animate-spin text-primary" aria-hidden="true" />
            {AI_CHAT_MESSAGES.loading}
          </p>
        ) : isEmpty ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <p className="max-w-xl text-center text-[13px] text-on-surface-variant">{!isReady && notReadyText ? notReadyText : emptyText}</p>
            {isReady && suggestions.length > 0 && (
              <div className="flex w-full max-w-2xl flex-col gap-2">
                <p className="flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-outline">
                  <Sparkles size={12} aria-hidden="true" />
                  {AI_CHAT_MESSAGES.suggestionsHeading}
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void ask(suggestion)}
                      className="min-h-11 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-left text-[13px] text-on-surface transition-colors hover:border-primary/50 hover:bg-primary/5"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-3" aria-label={`The chat: ${title}`} aria-live="polite">
            {messages.map((message) => (
              <Bubble
                key={message.id}
                role={message.role}
                text={message.text}
                provider={message.provider}
                note={message.role === "assistant" ? describeAnswer(message) : undefined}
              />
            ))}
            {isAnswering && <Bubble isStreaming role="assistant" text={answer || pendingText} />}
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
          onChange={(event) => setQuestion(event.target.value.slice(0, maxQuestionLength))}
          onKeyDown={onKeyDown}
          rows={isExpanded || tall ? 2 : 1}
          placeholder={placeholder}
          aria-label={inputLabel}
          className="custom-scrollbar max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-[14px] text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
        />
        <VoiceRecorder
          compact
          transcribeFor={transcribeFor}
          what="what you want to ask"
          showSource={false}
          disabled={isAnswering}
          onError={setError}
          onTranscript={(spoken) => {
            const { text } = appendSpokenText(question, spoken, maxQuestionLength)
            setQuestion(text)
            input.current?.focus()
          }}
        />
        {isAnswering ? (
          <button
            type="button"
            onClick={stop}
            aria-label="Stop the answer"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors hover:bg-surface-container-high"
          >
            <Square size={15} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void ask(question)}
            disabled={!question.trim()}
            aria-label="Ask"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowUp size={17} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* The two ways to ask, said plainly under the box, so the microphone is never just an icon
          nobody is sure about. The button itself carries the same words in its tooltip. */}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-outline">
        <span>
          <kbd className="rounded border border-outline-variant bg-surface-container-low px-1 font-sans text-[10px] font-semibold text-on-surface-variant">Enter</kbd> to
          ask, <kbd className="rounded border border-outline-variant bg-surface-container-low px-1 font-sans text-[10px] font-semibold text-on-surface-variant">Shift</kbd>+
          <kbd className="rounded border border-outline-variant bg-surface-container-low px-1 font-sans text-[10px] font-semibold text-on-surface-variant">Enter</kbd> for a new line
        </span>
        <span className="inline-flex items-center gap-1">
          <Mic size={12} aria-hidden="true" />
          Speak your question instead, {VOICE_MESSAGES.limit.toLowerCase()}
        </span>
      </p>
    </>
  )

  return (
    <>
      <section
        aria-label={title}
        className={`flex flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-sm ${fill ? "flex-1 p-3 sm:p-4" : "p-5"}`}
      >
        {!isExpanded && chat}
        {isExpanded && (
          <p className="flex items-center gap-2 py-2 text-[13px] text-on-surface-variant">
            <Icon size={15} className="text-primary" aria-hidden="true" />
            {AI_CHAT_MESSAGES.expanded}
          </p>
        )}
      </section>

      {isExpanded &&
        createPortal(
          <div role="dialog" aria-modal="true" aria-label={`${title}: ${subtitle}`} className="fixed inset-0 z-[80] flex flex-col gap-3 bg-background p-3 sm:p-5">
            {chat}
          </div>,
          document.body
        )}

      {isClearOpen && (
        <Modal
          title={AI_CHAT_MESSAGES.clearTitle}
          description={clearDescription}
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
          <p className="text-sm text-on-surface-variant">{AI_CHAT_MESSAGES.clearWarning}</p>
        </Modal>
      )}
    </>
  )
}
