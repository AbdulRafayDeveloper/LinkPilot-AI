"use client"

import React, { useCallback, useRef, useState } from "react"
import { FilePenLine, Languages, Sparkles } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { ResetButton } from "@/components/ui/ResetButton"
import { CopyButton } from "@/components/ui/CopyButton"
import { VoiceRecorder } from "@/components/ui/VoiceRecorder"
import { appendSpokenText } from "@/lib/spokenText"
import { VOICE_MESSAGES } from "@/constants/voiceInput"
import { DummyDataButton } from "@/components/dummy-data/DummyDataButton"
import { DummyDataModal } from "@/components/dummy-data/DummyDataModal"
import { MessageRewriterPromptModal } from "@/components/message-rewriter/MessageRewriterPromptModal"
import { RewrittenMessageResult } from "@/components/message-rewriter/RewrittenMessageResult"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { createGenerationRequest, useGenerationRequest } from "@/hooks/useGenerationRequest"
import { createToolStore, useToolStore } from "@/lib/toolStore"
import {
  MESSAGE_MAX_LENGTH,
  MESSAGE_REWRITER_ENDPOINT,
  MESSAGE_REWRITER_MESSAGES,
} from "@/constants/messageRewriter"
import type { MessageSource, RewrittenMessage } from "@/types/messageRewriter"

interface RewritePayload {
  message: string
  source: MessageSource
}

// The message you are rewriting outlives the page, like every other tool's input
const formStore = createToolStore(
  "message-rewriter:form",
  { message: "", source: "text" as MessageSource },
  { version: 1 }
)
const generation = createGenerationRequest<RewritePayload, RewrittenMessage>(
  "message-rewriter",
  `${MESSAGE_REWRITER_ENDPOINT}/generate`,
  MESSAGE_REWRITER_MESSAGES.generationFailed
)

export default function MessageRewriterClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isDummyDataOpen, setIsDummyDataOpen] = useState(false)
  const [isPromptOpen, setIsPromptOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null)
  const { message, source } = useToolStore(formStore)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const { status, result, error, generate, reset } = useGenerationRequest(generation)
  const isGenerating = status === "loading"
  const canReset = message !== "" || status !== "idle"

  const changeMessage = (value: string) => {
    formStore.update({ message: value, source: "text" })
    if (formError) setFormError(null)
  }

  // What was spoken is added to whatever is already there, so several takes build one message;
  // past the limit the beginning is kept and the page says how much was left out
  const addTranscript = useCallback((text: string) => {
    const { text: message, skipped } = appendSpokenText(formStore.getSnapshot().message, text, MESSAGE_MAX_LENGTH)
    formStore.update({ message, source: "voice" as MessageSource })
    setVoiceNotice(skipped > 0 ? VOICE_MESSAGES.clipped(skipped, MESSAGE_MAX_LENGTH) : null)
    setFormError(null)
  }, [])

  const submit = () => {
    if (isGenerating) return
    if (!message.trim()) {
      setFormError(MESSAGE_REWRITER_MESSAGES.missingMessage)
      messageInputRef.current?.focus()
      return
    }
    setFormError(null)
    generate({ message, source })
  }

  const loadDummyMessage = ({ message: dummyMessage }: Record<string, string>) => {
    formStore.update({ message: dummyMessage ?? "", source: "text" })
    reset()
    setFormError(null)
    setVoiceError(null)
    setVoiceNotice(null)
  }

  // Clears the message and the rewrite, ready for the next one
  const resetTool = () => {
    formStore.update({ message: "", source: "text" })
    setFormError(null)
    setVoiceError(null)
    setVoiceNotice(null)
    reset()
    messageInputRef.current?.focus()
  }

  const messageInvalid = formError === MESSAGE_REWRITER_MESSAGES.missingMessage

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
          <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-5 lg:h-full">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
                  <Languages size={24} className="text-primary shrink-0" aria-hidden="true" />
                  Message Rewriter
                </h1>
                <p className="text-sm text-on-surface-variant mt-1">
                  Say or paste a message in any language and get it back short, clear and in plain English, saying what
                  you meant.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:shrink-0">
                <ResetButton onReset={resetTool} disabled={!canReset} />
                <DummyDataButton onClick={() => setIsDummyDataOpen(true)} />
                <button
                  type="button"
                  onClick={() => setIsPromptOpen(true)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-outline-variant bg-white text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-colors"
                >
                  <FilePenLine size={16} aria-hidden="true" />
                  Update Prompt
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-5 lg:flex-1 lg:min-h-0">
              {/* The message to rewrite */}
              <section className="bg-white border border-outline-variant rounded-2xl shadow-sm p-5 flex flex-col gap-4 min-h-0">
                <div className="flex flex-col gap-2 min-h-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="original-message" className="text-[10px] font-bold text-outline uppercase tracking-wider">
                      Your message, in any language
                    </label>
                    <VoiceRecorder
                      transcribeFor="message-rewriter"
                      onTranscript={addTranscript}
                      onError={setVoiceError}
                      disabled={isGenerating}
                      what="your message"
                    />
                  </div>
                  <textarea
                    id="original-message"
                    ref={messageInputRef}
                    value={message}
                    onChange={(event) => changeMessage(event.target.value)}
                    maxLength={MESSAGE_MAX_LENGTH}
                    disabled={isGenerating}
                    aria-invalid={messageInvalid}
                    placeholder="Type it, paste it, or press Speak instead. Any language, and it does not have to be tidy."
                    className={`w-full flex-1 min-h-[180px] resize-none rounded-xl border bg-surface-container-lowest px-4 py-3 text-sm leading-relaxed text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60 ${
                      messageInvalid ? "border-error" : "border-outline-variant focus:border-primary/50"
                    }`}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-outline">
                    <span>
                      {message.length.toLocaleString()} / {MESSAGE_MAX_LENGTH.toLocaleString()} characters
                      {source === "voice" && message !== "" && " from your recording"}
                    </span>
                    {message !== "" && <CopyButton text={message} label="Copy what you wrote" />}
                  </div>
                  {voiceError && (
                    <p role="alert" className="rounded-xl border border-error/40 bg-error-container px-3 py-2 text-[12px] text-error">
                      {voiceError}
                    </p>
                  )}
                  {voiceNotice && (
                    <p role="status" className="rounded-xl bg-secondary-container px-3 py-2 text-[12px] text-on-secondary-container">
                      {voiceNotice}
                    </p>
                  )}
                </div>

                {formError && (
                  <p role="alert" className="text-[12px] text-error">
                    {formError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={submit}
                  disabled={isGenerating}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Sparkles size={16} aria-hidden="true" />
                  {isGenerating ? "Rewriting your message..." : "Rewrite Message"}
                </button>
              </section>

              <RewrittenMessageResult status={status} result={result} error={error} onRetry={submit} />
            </div>
          </div>
        </main>
      </div>

      {isDummyDataOpen && (
        <DummyDataModal
          kind="messages-to-rewrite"
          onUse={loadDummyMessage}
          onClose={() => setIsDummyDataOpen(false)}
        />
      )}
      {isPromptOpen && <MessageRewriterPromptModal onClose={() => setIsPromptOpen(false)} />}
    </div>
  )
}
