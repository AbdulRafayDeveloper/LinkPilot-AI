"use client"

import React, { useCallback, useRef, useState } from "react"
import { AudioLines, FilePenLine, Sparkles, Wand2 } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { ResultCard } from "@/components/ui/ResultCard"
import { ResetButton } from "@/components/ui/ResetButton"
import { RadioCardGroup } from "@/components/ui/RadioCardGroup"
import { CopyButton } from "@/components/ui/CopyButton"
import { DummyDataButton } from "@/components/dummy-data/DummyDataButton"
import { DummyDataModal } from "@/components/dummy-data/DummyDataModal"
import { CreatedPromptPanel } from "@/components/prompt-creator/CreatedPromptPanel"
import { PromptCreatorPromptsModal } from "@/components/prompt-creator/PromptCreatorPromptsModal"
import { VoiceRecorder } from "@/components/ui/VoiceRecorder"
import { appendSpokenText } from "@/lib/spokenText"
import { VOICE_MESSAGES, type TranscriptionProvider } from "@/constants/voiceInput"
import { describeProviders } from "@/constants/aiProviders"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { createGenerationRequest, useGenerationRequest } from "@/hooks/useGenerationRequest"
import { createToolStore, useToolStore } from "@/lib/toolStore"
import {
  DEFAULT_PROMPT_TARGET,
  PROMPT_CREATOR_ENDPOINT,
  PROMPT_CREATOR_MESSAGES,
  PROMPT_TARGETS,
  REQUEST_MAX_LENGTH,
  type PromptTargetId,
} from "@/constants/promptCreator"
import type { CreatedPrompt, RequestSource } from "@/types/promptCreator"

interface GeneratePayload {
  request: string
  target: PromptTargetId
  requestSource: RequestSource
}

// What was typed or spoken, who wrote the speech out, and the finished prompt all outlive the page
const formStore = createToolStore(
  "prompt-creator:form",
  {
    request: "",
    target: DEFAULT_PROMPT_TARGET as PromptTargetId | null,
    requestSource: "text" as RequestSource,
    transcribedBy: [] as TranscriptionProvider[],
  },
  { version: 2 }
)
const generation = createGenerationRequest<GeneratePayload, CreatedPrompt>(
  "prompt-creator",
  `${PROMPT_CREATOR_ENDPOINT}/generate`,
  PROMPT_CREATOR_MESSAGES.generationFailed
)

export default function PromptCreatorClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isDummyDataOpen, setIsDummyDataOpen] = useState(false)
  const [promptsTab, setPromptsTab] = useState<PromptTargetId | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null)
  const { request, target, requestSource, transcribedBy } = useToolStore(formStore)
  const requestInputRef = useRef<HTMLTextAreaElement>(null)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const { status, result, error, generate, reset } = useGenerationRequest(generation)
  const isGenerating = status === "loading"
  const canReset = request !== "" || status !== "idle"

  const changeRequest = (value: string) => {
    formStore.update({ request: value, requestSource: "text" })
    if (formError) setFormError(null)
  }

  // What was spoken is added to whatever is already there, so several takes build one description;
  // past the limit the beginning is kept and the page says how much was left out. Who wrote each take
  // out is kept with it, so the page can say whether Groq or OpenAI did
  const addTranscript = useCallback((text: string, providers: TranscriptionProvider[]) => {
    const current = formStore.getSnapshot()
    const { text: request, skipped } = appendSpokenText(current.request, text, REQUEST_MAX_LENGTH)
    const earlier = current.request.trim() ? current.transcribedBy : []
    formStore.update({ request, requestSource: "voice" as RequestSource, transcribedBy: [...new Set([...earlier, ...providers])] })
    setVoiceNotice(skipped > 0 ? VOICE_MESSAGES.clipped(skipped, REQUEST_MAX_LENGTH) : null)
    setFormError(null)
  }, [])

  const submit = () => {
    if (isGenerating) return
    if (!request.trim()) {
      setFormError(PROMPT_CREATOR_MESSAGES.missingRequest)
      requestInputRef.current?.focus()
      return
    }
    if (!target) {
      setFormError(PROMPT_CREATOR_MESSAGES.missingTarget)
      return
    }
    setFormError(null)
    generate({ request, target, requestSource })
  }

  // The page keeps the created prompt exactly as it was saved
  const applyChanges = useCallback((changes: { name?: string; prompt?: string }) => {
    generation.store.update((state) => (state.result ? { result: { ...state.result, ...changes } } : {}))
  }, [])

  const loadDummyRequest = ({ request: dummyRequest }: Record<string, string>) => {
    formStore.update({ request: dummyRequest ?? "", requestSource: "text", transcribedBy: [] })
    reset()
    setFormError(null)
    setVoiceError(null)
    setVoiceNotice(null)
  }

  // Clears the description and the prompt; the chosen target stays for the next one
  const resetTool = () => {
    formStore.update({ request: "", requestSource: "text", transcribedBy: [] })
    setFormError(null)
    setVoiceError(null)
    setVoiceNotice(null)
    reset()
    requestInputRef.current?.focus()
  }

  const requestInvalid = formError === PROMPT_CREATOR_MESSAGES.missingRequest

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
                  <Wand2 size={24} className="text-primary shrink-0" aria-hidden="true" />
                  Prompt Creator
                </h1>
                <p className="text-sm text-on-surface-variant mt-1">
                  Say or type what you want done, and get a clear English prompt written for the AI that will do it.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:shrink-0">
                <ResetButton onReset={resetTool} disabled={!canReset} />
                <DummyDataButton onClick={() => setIsDummyDataOpen(true)} />
                <button
                  type="button"
                  onClick={() => setPromptsTab(target ?? DEFAULT_PROMPT_TARGET)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-outline-variant bg-white text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-colors"
                >
                  <FilePenLine size={16} aria-hidden="true" />
                  Update Prompt
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-5 lg:flex-1 lg:min-h-0">
              {/* What the user wants done */}
              <section className="bg-white border border-outline-variant rounded-2xl shadow-sm p-5 flex flex-col gap-4 min-h-0">
                <div className="flex flex-col gap-2 min-h-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="prompt-request" className="text-[10px] font-bold text-outline uppercase tracking-wider">
                      What do you want done
                    </label>
                    <VoiceRecorder
                      onTranscript={addTranscript}
                      onError={setVoiceError}
                      disabled={isGenerating}
                      what="what you want done"
                      transcribeFor="prompt-creator"
                      showSource={false}
                    />
                  </div>
                  <textarea
                    id="prompt-request"
                    ref={requestInputRef}
                    value={request}
                    onChange={(event) => changeRequest(event.target.value)}
                    maxLength={REQUEST_MAX_LENGTH}
                    disabled={isGenerating}
                    aria-invalid={requestInvalid}
                    placeholder="Describe the task in your own words. Example: add a dark mode toggle to my Next.js dashboard and make sure nothing else breaks."
                    className={`w-full flex-1 min-h-[180px] resize-none rounded-xl border bg-surface-container-lowest px-4 py-3 text-sm leading-relaxed text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60 ${
                      requestInvalid ? "border-error" : "border-outline-variant focus:border-primary/50"
                    }`}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-outline">
                    <span>
                      {request.length.toLocaleString()} / {REQUEST_MAX_LENGTH.toLocaleString()} characters
                      {requestSource === "voice" && request !== "" && " from your recording"}
                    </span>
                    {request !== "" && <CopyButton text={request} label="Copy what you described" />}
                  </div>
                  {requestSource === "voice" && request !== "" && transcribedBy.length > 0 && (
                    <p role="status" className="flex items-center gap-1.5 text-[12px] text-on-surface-variant">
                      <AudioLines size={13} className="shrink-0 text-primary" aria-hidden="true" />
                      Speech written out by{" "}
                      <span className="font-semibold text-on-surface">{describeProviders(transcribedBy)}</span>
                    </p>
                  )}
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

                <RadioCardGroup
                  name="prompt-target"
                  legend="Create the prompt for"
                  options={PROMPT_TARGETS}
                  value={target}
                  onChange={(nextTarget) => {
                    formStore.update({ target: nextTarget })
                    if (formError === PROMPT_CREATOR_MESSAGES.missingTarget) setFormError(null)
                  }}
                  disabled={isGenerating}
                  invalid={formError === PROMPT_CREATOR_MESSAGES.missingTarget}
                  wrapLabels
                />

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
                  {isGenerating ? "Writing your prompt..." : "Create Prompt"}
                </button>
              </section>

              <ResultCard
                title="Your Prompt"
                status={status}
                error={error}
                onRetry={submit}
                idleIcon={Wand2}
                idleText="Describe the task, pick what the prompt is for, and get a complete prompt you can paste straight into it."
                loadingText="Writing your prompt..."
                headerAction={
                  result && <CopyButton text={result.prompt} label="Copy the prompt" variant="prominent" buttonText="Copy Prompt" />
                }
              >
                {result && <CreatedPromptPanel key={result.id} created={result} onChange={applyChanges} />}
              </ResultCard>
            </div>
          </div>
        </main>
      </div>

      {promptsTab && <PromptCreatorPromptsModal initialTarget={promptsTab} onClose={() => setPromptsTab(null)} />}
      {isDummyDataOpen && (
        <DummyDataModal kind="prompt-requests" onUse={loadDummyRequest} onClose={() => setIsDummyDataOpen(false)} />
      )}
    </div>
  )
}
