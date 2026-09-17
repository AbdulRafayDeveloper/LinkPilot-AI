"use client"

import React, { useRef, useState } from "react"
import { AlertTriangle, FilePenLine, Loader2, Repeat, Sparkles } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { RadioCardGroup } from "@/components/ui/RadioCardGroup"
import { FollowUpResult } from "@/components/follow-up-message/FollowUpResult"
import { FollowUpPromptsModal } from "@/components/follow-up-message/FollowUpPromptsModal"
import { LeadSignalsTable } from "@/components/lead-signals/LeadSignalsTable"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { ResetButton } from "@/components/ui/ResetButton"
import { DummyDataButton } from "@/components/dummy-data/DummyDataButton"
import { DummyDataModal } from "@/components/dummy-data/DummyDataModal"
import { createGenerationRequest, useGenerationRequest } from "@/hooks/useGenerationRequest"
import { createToolStore, useToolStore } from "@/lib/toolStore"
import {
  CONVERSATION_MAX_LENGTH,
  FOLLOW_UP_MESSAGES,
  FOLLOW_UP_PROFILE_MAX_LENGTH,
  FOLLOW_UP_TYPES,
  type FollowUpTypeId,
} from "@/constants/followUp"
import type { GeneratedFollowUp } from "@/types/followUp"

const CONVERSATION_INPUT_ID = "follow-up-conversation"
const PROFILE_INPUT_ID = "follow-up-profile"
const FORM_ERROR_ID = "follow-up-form-error"
const GENERATE_ENDPOINT = "/api/follow-up-messages/generate"

interface GeneratePayload {
  conversation: string
  profileData: string
  followUpType: FollowUpTypeId
}

// Inputs and the result outlive the page, so they're still here after visiting another tool
const formStore = createToolStore(
  "follow-up-message:form",
  { conversation: "", profileData: "", followUpType: null as FollowUpTypeId | null },
  { version: 1 }
)
const generation = createGenerationRequest<GeneratePayload, GeneratedFollowUp>(
  "follow-up-message",
  GENERATE_ENDPOINT,
  FOLLOW_UP_MESSAGES.generationFailed,
  // v2 added the lead signals, v3 the extra client-hunting signals
  { resultVersion: 3 }
)

const labelClass = "text-[10px] font-bold text-outline uppercase tracking-wider"
const textareaClass =
  "w-full resize-none rounded-xl border bg-surface-container-lowest p-3 text-[13px] leading-relaxed text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"

export default function FollowUpMessageClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isDummyDataOpen, setIsDummyDataOpen] = useState(false)
  const [isPromptsOpen, setIsPromptsOpen] = useState(false)
  const { conversation, profileData, followUpType } = useToolStore(formStore)
  const [formError, setFormError] = useState<string | null>(null)
  const conversationInputRef = useRef<HTMLTextAreaElement>(null)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const { status, result, error, generate, reset } = useGenerationRequest(generation)
  const isGenerating = status === "loading"
  const canReset = conversation !== "" || profileData !== "" || status !== "idle"
  const isConversationMissing = formError === FOLLOW_UP_MESSAGES.missingConversation
  const isTypeMissing = formError === FOLLOW_UP_MESSAGES.missingType
  const showSignals = isGenerating || (status === "success" && result !== null)

  const submit = () => {
    if (!conversation.trim()) {
      setFormError(FOLLOW_UP_MESSAGES.missingConversation)
      conversationInputRef.current?.focus()
      return
    }
    if (!followUpType) {
      setFormError(FOLLOW_UP_MESSAGES.missingType)
      return
    }
    setFormError(null)
    generate({ conversation, profileData, followUpType })
  }

  // A dummy conversation fills the conversation and profile; the follow-up for the previous one goes with it
  const loadDummyConversation = ({ conversation, profile }: Record<string, string>) => {
    formStore.update({ conversation: conversation ?? "", profileData: profile ?? "" })
    reset()
    setFormError(null)
  }

  // Clears the conversation, profile and result; the chosen follow-up type stays
  const resetTool = () => {
    formStore.update({ conversation: "", profileData: "" })
    reset()
    setFormError(null)
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

        <main className="flex-1 overflow-y-auto bg-background overflow-x-hidden">
          <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-5 lg:h-full">
            {/* Page header */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
                  <Repeat size={24} className="text-primary shrink-0" aria-hidden="true" />
                  Follow-Up Message
                </h1>
                <p className="text-sm text-on-surface-variant mt-1">
                  Generate natural follow-ups from your previous conversation.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 xl:shrink-0">
                <ResetButton onReset={resetTool} disabled={!canReset} />
                <DummyDataButton onClick={() => setIsDummyDataOpen(true)} />
                <button
                  type="button"
                  onClick={() => setIsPromptsOpen(true)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center whitespace-nowrap gap-2 px-4 py-2.5 border border-outline-variant bg-white text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-colors"
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
                className="bg-white border border-outline-variant rounded-2xl shadow-sm p-5 flex flex-col gap-4 min-h-0"
              >
                <div className="flex flex-col flex-[3] min-h-0">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label htmlFor={CONVERSATION_INPUT_ID} className={labelClass}>
                      Previous Conversation
                    </label>
                    <span className="text-[11px] text-outline">
                      {conversation.length.toLocaleString()} / {CONVERSATION_MAX_LENGTH.toLocaleString()}
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
                    maxLength={CONVERSATION_MAX_LENGTH}
                    placeholder="Paste your previous LinkedIn conversation here..."
                    aria-invalid={isConversationMissing}
                    aria-describedby={isConversationMissing ? FORM_ERROR_ID : undefined}
                    className={`${textareaClass} flex-1 min-h-[200px] lg:min-h-[140px] ${
                      isConversationMissing ? "border-error" : "border-outline-variant"
                    }`}
                  />
                </div>

                <div className="flex flex-col flex-[2] min-h-0">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label htmlFor={PROFILE_INPUT_ID} className={labelClass}>
                      Profile Information <span className="normal-case font-semibold tracking-normal">(optional)</span>
                    </label>
                    <span className="text-[11px] text-outline">
                      {profileData.length.toLocaleString()} / {FOLLOW_UP_PROFILE_MAX_LENGTH.toLocaleString()}
                    </span>
                  </div>
                  <textarea
                    id={PROFILE_INPUT_ID}
                    value={profileData}
                    onChange={(event) => formStore.update({ profileData: event.target.value })}
                    maxLength={FOLLOW_UP_PROFILE_MAX_LENGTH}
                    placeholder="Paste their LinkedIn profile information to personalize the follow-up..."
                    className={`${textareaClass} flex-1 min-h-[120px] lg:min-h-[90px] border-outline-variant`}
                  />
                </div>

                <RadioCardGroup
                  name="follow-up-type"
                  legend="Follow-Up Type"
                  options={FOLLOW_UP_TYPES}
                  value={followUpType}
                  onChange={(nextType) => {
                    formStore.update({ followUpType: nextType })
                    if (isTypeMissing) setFormError(null)
                  }}
                  disabled={isGenerating}
                  invalid={isTypeMissing}
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
                    <Sparkles size={16} aria-hidden="true" />
                  )}
                  {isGenerating ? "Generating follow-up..." : "Generate Follow-Up"}
                </button>
              </form>

              {/* Output: the follow-up, then the lead signals; the column scrolls on its own */}
              <div className="flex flex-col gap-5 min-w-0 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
                <div className={`grid ${showSignals ? "shrink-0" : "flex-1"}`}>
                  <FollowUpResult status={status} result={result} error={error} onRetry={submit} />
                </div>
                {showSignals && <LeadSignalsTable signals={result?.signals ?? null} isLoading={isGenerating} />}
              </div>
            </div>
          </div>
        </main>
      </div>

      {isPromptsOpen && <FollowUpPromptsModal initialTab={followUpType} onClose={() => setIsPromptsOpen(false)} />}
      {isDummyDataOpen && (
        <DummyDataModal kind="follow-up-conversations" onUse={loadDummyConversation} onClose={() => setIsDummyDataOpen(false)} />
      )}
    </div>
  )
}
