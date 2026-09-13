"use client"

import React, { useRef, useState } from "react"
import { AlertTriangle, FilePenLine, Info, Loader2, MessagesSquare, ScanSearch } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { RadioCardGroup } from "@/components/ui/RadioCardGroup"
import { GeneratedResultPanel } from "@/components/ui/GeneratedResultPanel"
import { ConversationAnalysisCard } from "@/components/conversation-reply/ConversationAnalysisCard"
import { LeadSignalsTable } from "@/components/lead-signals/LeadSignalsTable"
import { ConversationReplyPromptsModal } from "@/components/conversation-reply/ConversationReplyPromptsModal"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { ResetButton } from "@/components/ui/ResetButton"
import { DummyDataButton } from "@/components/dummy-data/DummyDataButton"
import { DummyDataModal } from "@/components/dummy-data/DummyDataModal"
import { createGenerationRequest, useGenerationRequest } from "@/hooks/useGenerationRequest"
import { createToolStore, useToolStore } from "@/lib/toolStore"
import {
  ABOUT_ME_TAB_ID,
  CONVERSATION_REPLY_CONVERSATION_MAX_LENGTH,
  CONVERSATION_REPLY_MESSAGES,
  CONVERSATION_REPLY_PROFILE_MAX_LENGTH,
  CONVERSATION_REPLY_TYPES,
  DEFAULT_CONVERSATION_REPLY_TYPE,
  getReplyTypeLabel,
  type ConversationReplyPromptId,
  type ConversationReplyTypeId,
} from "@/constants/conversationReply"
import type { ConversationReplyResult } from "@/types/conversationReply"

const CONVERSATION_INPUT_ID = "conversation-reply-conversation"
const PROFILE_INPUT_ID = "conversation-reply-profile"
const FORM_ERROR_ID = "conversation-reply-form-error"
const GENERATE_ENDPOINT = "/api/conversation-replies/generate"
const LOADING_TEXT = "Analyzing Conversation & Generating Reply..."

interface GeneratePayload {
  conversation: string
  profileData: string
  replyType: ConversationReplyTypeId
}

// Inputs and the result outlive the page, so they're still here after visiting another tool
const formStore = createToolStore(
  "conversation-reply:form",
  { conversation: "", profileData: "", replyType: DEFAULT_CONVERSATION_REPLY_TYPE as ConversationReplyTypeId },
  // v2: the reply tones were replaced, so a tone saved by v1 no longer exists
  { version: 2 }
)
const generation = createGenerationRequest<GeneratePayload, ConversationReplyResult>(
  "conversation-reply",
  GENERATE_ENDPOINT,
  CONVERSATION_REPLY_MESSAGES.generationFailed,
  // v2 replaced the tones, v3 added the lead signals
  { resultVersion: 3 }
)

const labelClass = "text-[10px] font-bold text-outline uppercase tracking-wider"
const textareaClass =
  "flex-1 w-full resize-none rounded-xl border bg-surface-container-lowest p-3 text-[13px] leading-relaxed text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"

export default function ConversationReplyClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isDummyDataOpen, setIsDummyDataOpen] = useState(false)
  // The tab the prompts modal opens on; null means the modal is closed
  const [promptsTab, setPromptsTab] = useState<ConversationReplyPromptId | null>(null)
  const { conversation, profileData, replyType } = useToolStore(formStore)
  const [formError, setFormError] = useState<string | null>(null)
  const conversationInputRef = useRef<HTMLTextAreaElement>(null)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const { status, result, error, generate, reset } = useGenerationRequest(generation)
  const isGenerating = status === "loading"
  const canReset = conversation !== "" || profileData !== "" || status !== "idle"
  const isConversationMissing = formError === CONVERSATION_REPLY_MESSAGES.missingConversation
  const showAnalysis = isGenerating || (status === "success" && result !== null)

  const submit = () => {
    if (isGenerating) return
    if (!conversation.trim()) {
      setFormError(CONVERSATION_REPLY_MESSAGES.missingConversation)
      conversationInputRef.current?.focus()
      return
    }
    setFormError(null)
    generate({ conversation, profileData, replyType })
  }

  // A dummy conversation fills the conversation and profile; the reply for the previous one goes with it
  const loadDummyConversation = ({ conversation, profile }: Record<string, string>) => {
    formStore.update({ conversation: conversation ?? "", profileData: profile ?? "" })
    reset()
    setFormError(null)
  }

  // Clears the conversation, profile and result; the chosen reply tone stays
  const resetTool = () => {
    formStore.update({ conversation: "", profileData: "" })
    setFormError(null)
    reset()
    conversationInputRef.current?.focus()
  }

  return (
    <div className="font-body-md text-body-md min-h-screen bg-background text-on-surface flex overflow-hidden h-screen">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        <Header
          onOpenSidebar={() => setIsSidebarOpen(true)}
          isSidebarCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapsed}
        />

        <main className="flex-1 overflow-y-auto bg-[#FAF7F2] overflow-x-hidden">
          <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-5 lg:h-full">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
                  <MessagesSquare size={24} className="text-primary shrink-0" aria-hidden="true" />
                  Conversation Reply Analyzer
                </h1>
                <p className="text-sm text-on-surface-variant mt-1">
                  Decide what to reply next and see how valuable the conversation really is.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:shrink-0">
                <ResetButton onReset={resetTool} disabled={!canReset} />
                <DummyDataButton onClick={() => setIsDummyDataOpen(true)} />
                <button
                  type="button"
                  onClick={() => setPromptsTab(replyType)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-outline-variant bg-white text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-colors"
                >
                  <FilePenLine size={16} aria-hidden="true" />
                  Update Prompt
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-5 lg:flex-1 lg:min-h-0">
              {/* Input */}
              <form
                noValidate
                onSubmit={(event) => {
                  event.preventDefault()
                  submit()
                }}
                className="bg-white border border-outline-variant rounded-2xl shadow-sm p-5 flex flex-col gap-4 min-h-0 lg:overflow-y-auto"
              >
                {/* The fields grow into spare height but never shrink below their textarea's minimum */}
                <div className="flex flex-col flex-[3]">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label htmlFor={CONVERSATION_INPUT_ID} className={labelClass}>
                      Previous Conversation
                    </label>
                    <span className="text-[11px] text-outline">
                      {conversation.length.toLocaleString()} / {CONVERSATION_REPLY_CONVERSATION_MAX_LENGTH.toLocaleString()}
                    </span>
                  </div>
                  <textarea
                    ref={conversationInputRef}
                    id={CONVERSATION_INPUT_ID}
                    value={conversation}
                    onChange={(event) => {
                      formStore.update({ conversation: event.target.value })
                      if (isConversationMissing) setFormError(null)
                    }}
                    maxLength={CONVERSATION_REPLY_CONVERSATION_MAX_LENGTH}
                    placeholder="Paste the complete conversation here..."
                    aria-invalid={isConversationMissing}
                    aria-describedby={isConversationMissing ? FORM_ERROR_ID : undefined}
                    className={`${textareaClass} min-h-[200px] lg:min-h-[96px] ${
                      isConversationMissing ? "border-error" : "border-outline-variant"
                    }`}
                  />
                </div>

                <div className="flex flex-col flex-[2]">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label htmlFor={PROFILE_INPUT_ID} className={labelClass}>
                      Profile Information <span className="normal-case font-semibold tracking-normal">(optional)</span>
                    </label>
                    <span className="text-[11px] text-outline">
                      {profileData.length.toLocaleString()} / {CONVERSATION_REPLY_PROFILE_MAX_LENGTH.toLocaleString()}
                    </span>
                  </div>
                  <textarea
                    id={PROFILE_INPUT_ID}
                    value={profileData}
                    onChange={(event) => formStore.update({ profileData: event.target.value })}
                    maxLength={CONVERSATION_REPLY_PROFILE_MAX_LENGTH}
                    placeholder="Paste the person's LinkedIn profile information here if available..."
                    className={`${textareaClass} min-h-[110px] lg:min-h-[64px] border-outline-variant`}
                  />
                </div>

                <RadioCardGroup
                  name="conversation-reply-type"
                  legend="Reply Tone"
                  options={CONVERSATION_REPLY_TYPES}
                  columnsClassName="grid-cols-2 md:grid-cols-3"
                  wrapLabels
                  value={replyType}
                  onChange={(nextType) => formStore.update({ replyType: nextType })}
                  disabled={isGenerating}
                />

                {formError && (
                  <p id={FORM_ERROR_ID} role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-error">
                    <AlertTriangle size={14} className="shrink-0" aria-hidden="true" />
                    {formError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isGenerating}
                  aria-busy={isGenerating}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-on-primary-fixed-variant text-white rounded-xl text-sm font-semibold shadow-sm active:scale-[0.99] transition-all disabled:opacity-70 disabled:cursor-not-allowed shrink-0"
                >
                  {isGenerating ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <ScanSearch size={16} aria-hidden="true" />
                  )}
                  {isGenerating ? LOADING_TEXT : "Analyze & Generate Reply"}
                </button>
              </form>

              {/* Output: scrolls inside its own column so the page stays one screen */}
              <div className="flex flex-col gap-5 min-w-0 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
                <div className={`grid ${showAnalysis ? "shrink-0" : "flex-1"}`}>
                  <GeneratedResultPanel
                    title="Suggested Reply"
                    status={status}
                    text={result?.reply ?? null}
                    error={error}
                    onRetry={submit}
                    idleIcon={MessagesSquare}
                    idleText="Paste the conversation, choose a reply tone, and get the next reply plus an honest read of the opportunity."
                    loadingText={LOADING_TEXT}
                    copyLabel="Copy suggested reply"
                    copyButtonText="Copy Reply"
                    warning={result?.warning}
                    meta={
                      result && (
                        <>
                          {result.characterCount.toLocaleString()} characters · {getReplyTypeLabel(result.replyType)}
                          {result.usedProfile && " · Profile used"}
                        </>
                      )
                    }
                  >
                    {result && (
                      <p className="text-[12px] leading-relaxed text-on-surface-variant">
                        <span className="font-semibold text-on-surface">Approach: </span>
                        {result.strategyNote}
                      </p>
                    )}
                    {result && !result.usedSenderProfile && (
                      <p className="flex items-start gap-2 bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-[12px] text-on-surface-variant">
                        <Info size={14} className="shrink-0 mt-0.5 text-primary" aria-hidden="true" />
                        <span>
                          About Me isn&apos;t filled in, so the reply and Opportunity Fit only know what you said in the
                          conversation. Add it under{" "}
                          <button
                            type="button"
                            onClick={() => setPromptsTab(ABOUT_ME_TAB_ID)}
                            className="font-semibold text-primary hover:underline"
                          >
                            Update Prompt → About Me
                          </button>
                          .
                        </span>
                      </p>
                    )}
                  </GeneratedResultPanel>
                </div>

                {showAnalysis && <LeadSignalsTable signals={result?.leadSignals ?? null} isLoading={isGenerating} />}
                {showAnalysis && <ConversationAnalysisCard analysis={result?.analysis ?? null} isLoading={isGenerating} />}
              </div>
            </div>
          </div>
        </main>
      </div>

      {promptsTab && <ConversationReplyPromptsModal initialTab={promptsTab} onClose={() => setPromptsTab(null)} />}
      {isDummyDataOpen && (
        <DummyDataModal kind="reply-conversations" onUse={loadDummyConversation} onClose={() => setIsDummyDataOpen(false)} />
      )}
    </div>
  )
}
