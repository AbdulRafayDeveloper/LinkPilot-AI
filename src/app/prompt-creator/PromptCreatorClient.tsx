"use client"

import React, { useCallback, useRef, useState } from "react"
import { AudioLines, FolderKanban, Languages, Sparkles, Wand2 } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { ResultCard } from "@/components/ui/ResultCard"
import { ResetButton } from "@/components/ui/ResetButton"
import { RadioCardGroup } from "@/components/ui/RadioCardGroup"
import { CopyButton } from "@/components/ui/CopyButton"
import { useDummyHandoff } from "@/hooks/useDummyHandoff"
import { CreatedPromptPanel, type CreatedPromptChanges } from "@/components/prompt-creator/CreatedPromptPanel"
import { EnglishDescriptionPanel } from "@/components/prompt-creator/EnglishDescriptionPanel"
import Link from "next/link"
import { usePromptProjects } from "@/hooks/usePromptProjects"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { isFeatureDisabled } from "@/lib/featureAccess"
import { VoiceRecorder } from "@/components/ui/VoiceRecorder"
import { appendSpokenText } from "@/lib/spokenText"
import { VOICE_MESSAGES, type TranscriptionProvider } from "@/constants/voiceInput"
import { describeProviders } from "@/constants/aiProviders"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { createGenerationRequest, useGenerationRequest } from "@/hooks/useGenerationRequest"
import { createToolStore, useToolStore } from "@/lib/toolStore"
import { requestApi } from "@/lib/apiClient"
import {
  NO_PROJECT,
  PROMPT_PROJECT_MESSAGES,
  DEFAULT_PROMPT_TARGET,
  PROMPT_CREATOR_ENDPOINT,
  PROMPT_CREATOR_ENGLISH_PATH,
  PROMPT_CREATOR_MESSAGES,
  PROMPT_TARGETS,
  REQUEST_MAX_LENGTH,
  type PromptTargetId,
} from "@/constants/promptCreator"
import { CLIENTS_TOOL } from "@/constants/clients"
import type { CreatedPrompt, RequestSource, SimpleEnglish } from "@/types/promptCreator"

interface GeneratePayload {
  request: string
  target: PromptTargetId
  requestSource: RequestSource
  // The project the prompt is for; its instructions end the prompt
  projectId: string | null
  // A prompt to work with now and not keep: nothing is saved, whatever project it is for
  temporary: boolean
  // The description in clear English, when it has been read back; kept with the prompt
  englishRequest: string
  // Write the prompt from that English rather than from what is in the box
  fromEnglish: boolean
}

// What was typed or spoken, who wrote the speech out, and the finished prompt all outlive the page
const formStore = createToolStore(
  "prompt-creator:form",
  {
    request: "",
    target: DEFAULT_PROMPT_TARGET as PromptTargetId | null,
    requestSource: "text" as RequestSource,
    transcribedBy: [] as TranscriptionProvider[],
    // The project last written for, so the next prompt starts in the same one
    projectId: null as string | null,
    isTemporary: false,
    // What the description says in clear English, once it has been read back, with the language it
    // was read from and the exact text it was read from (so the page can say when it is out of date)
    english: "",
    englishLanguage: "",
    englishFor: "",
  },
  // The target, the project and whether a prompt is kept are choices rather than work, so they
  // outlive the session the way the sidebar remembers being collapsed
  { version: 6, remember: ["target", "projectId", "isTemporary"] }
)
const generation = createGenerationRequest<GeneratePayload, CreatedPrompt>(
  "prompt-creator",
  `${PROMPT_CREATOR_ENDPOINT}/generate`,
  PROMPT_CREATOR_MESSAGES.generationFailed
)

export default function PromptCreatorClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null)
  const { request, target, requestSource, transcribedBy, projectId, isTemporary, english, englishLanguage, englishFor } = useToolStore(formStore)
  const [isReadingEnglish, setIsReadingEnglish] = useState(false)
  // Projects are their own tool, which an admin can turn off for an account while leaving this one on:
  // then the picker goes, nothing is sent, and the list is not even asked for (the server ignores a
  // project id from such an account too, so a stale one left in the browser can't bring it back)
  const viewer = useCurrentUser()
  /**
   * A project is a client's project now, so Clients Management is what decides whether this account
   * has projects at all: with that tool off, there is nothing to pick and the picker is not shown.
   */
  const projectsOff = isFeatureDisabled(viewer.user, CLIENTS_TOOL.id)
  const projects = usePromptProjects({ enabled: viewer.status === "ready" && !projectsOff })
  // A project deleted in another tab must not be sent with the next prompt
  const selectedProject = projects.projects?.find((project) => project.id === projectId) ?? null
  const currentProjectId = projectsOff || (projects.projects && !selectedProject) ? null : projectId
  const requestInputRef = useRef<HTMLTextAreaElement>(null)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const { status, result, error, generate, reset } = useGenerationRequest(generation)
  const isGenerating = status === "loading"
  const isBusy = isGenerating || isReadingEnglish
  const canReset = request !== "" || english !== "" || status !== "idle"
  // The English is kept with the prompt only while it is the reading of what is in the box: once
  // the description is edited the two no longer say the same thing
  const englishMatches = english !== "" && englishFor === request.trim()

  const changeRequest = (value: string) => {
    formStore.update({ request: value, requestSource: "text" })
    if (formError) setFormError(null)
  }

  /**
   * Reads the description back in clear English, for the user to check and copy. It is one model
   * call that stores nothing: the English version is saved only with the prompt itself.
   */
  const readInEnglish = async () => {
    if (isBusy) return
    const description = request.trim()
    if (!description) {
      setFormError(PROMPT_CREATOR_MESSAGES.englishEmpty)
      requestInputRef.current?.focus()
      return
    }
    setFormError(null)
    setIsReadingEnglish(true)
    try {
      // Nothing is saved by this call, so a dropped request is safe to send again
      const { data } = await requestApi<SimpleEnglish>(
        `${PROMPT_CREATOR_ENDPOINT}${PROMPT_CREATOR_ENGLISH_PATH}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request: description }) },
        { retry: true }
      )
      formStore.update({ english: data.english, englishLanguage: data.sourceLanguage, englishFor: description })
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : PROMPT_CREATOR_MESSAGES.englishFailed)
    } finally {
      setIsReadingEnglish(false)
    }
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

  const submit = (fromEnglish = false) => {
    if (isBusy) return
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
    generate({
      request,
      target,
      requestSource,
      projectId: currentProjectId,
      temporary: isTemporary,
      englishRequest: englishMatches ? english : "",
      // Written from the English only when the user asked for that, and only while it is current
      fromEnglish: fromEnglish && englishMatches,
    })
    // A prompt that is kept counts towards its project; a temporary one is never stored
    if (!isTemporary) projects.countCreated(currentProjectId)
  }

  // The page keeps the created prompt exactly as it was saved
  const applyChanges = useCallback((changes: CreatedPromptChanges) => {
    generation.store.update((state) => (state.result ? { result: { ...state.result, ...changes } } : {}))
  }, [])

  const loadDummyRequest = ({ request: dummyRequest }: Record<string, string>) => {
    formStore.update({ request: dummyRequest ?? "", requestSource: "text", transcribedBy: [], english: "", englishLanguage: "", englishFor: "" })
    reset()
    setFormError(null)
    setVoiceError(null)
    setVoiceNotice(null)
  }

  // Sample data comes from the Dummy Data module (Administration), which opens this tool with
  // an item already chosen; the tool itself no longer carries a button for it
  useDummyHandoff("prompt-requests", loadDummyRequest)

  // Clears the description and the prompt; the chosen target and project stay for the next one
  const resetTool = () => {
    formStore.update({ request: "", requestSource: "text", transcribedBy: [], english: "", englishLanguage: "", englishFor: "" })
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
          <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-5 lg:min-h-full">
            {/* Page header */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
                  <Wand2 size={24} className="text-primary shrink-0" aria-hidden="true" />
                  Prompt Creator
                </h1>
                <p className="text-sm text-on-surface-variant mt-1">
                  Say or type what you want done, and get a clear English prompt written for the AI that will do it.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 xl:shrink-0">
                <ResetButton onReset={resetTool} disabled={!canReset} />
              </div>
            </div>

            {/* The form takes about 65% and the written prompt 35%: what is typed, the targets, the
                project and the choices all live on the left, while the prompt itself reads fine narrower */}
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)] gap-5 short:gap-3 lg:flex-1">
              {/* What the user wants done */}
              {/* gap-5 between the blocks, so the targets, the project and the choice below the text box
                  are not crowded together now that the form has the wider side */}
              <section className="bg-white border border-outline-variant rounded-2xl shadow-sm p-5 short:p-3 flex flex-col gap-5 short:gap-4 lg:self-start">
                <div className="flex flex-col gap-2 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="prompt-request" className="text-[10px] font-bold text-outline uppercase tracking-wider">
                      What do you want done
                    </label>
                    <VoiceRecorder
                      onTranscript={addTranscript}
                      onError={setVoiceError}
                      disabled={isBusy}
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
                    disabled={isBusy}
                    aria-invalid={requestInvalid}
                    placeholder="Describe the task in your own words. Example: add a dark mode toggle to my Next.js dashboard and make sure nothing else breaks."
                    className={`w-full flex-1 min-h-[180px] resize-none rounded-xl border bg-surface-container-lowest px-4 py-3 text-sm leading-relaxed text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60 ${
                      requestInvalid ? "border-error" : "border-outline-variant focus:border-primary/50"
                    }`}
                  />
                  {/* The count, who wrote the speech out and Copy share one line, so the model that
                      wrote it never costs the form a row of its own */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-outline">
                    <span>
                      {request.length.toLocaleString()} / {REQUEST_MAX_LENGTH.toLocaleString()} characters
                      {/* "Written out by ..." beside it already says it came from a recording */}
                      {requestSource === "voice" && request !== "" && transcribedBy.length === 0 && " from your recording"}
                    </span>
                    {requestSource === "voice" && request !== "" && transcribedBy.length > 0 && (
                      <span role="status" className="inline-flex items-center gap-1 text-on-surface-variant">
                        <AudioLines size={12} className="shrink-0 text-primary" aria-hidden="true" />
                        Written out by <span className="font-semibold text-on-surface">{describeProviders(transcribedBy)}</span>
                      </span>
                    )}
                    {/* It follows the text rather than sitting at the right edge, so the three keep
                        one line on a narrow laptop column too */}
                    {request !== "" && <CopyButton text={request} label="Copy what you described" />}
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
                  {english !== "" && (
                    <EnglishDescriptionPanel
                      english={english}
                      sourceLanguage={englishLanguage}
                      stale={!englishMatches}
                      onUse={() => submit(true)}
                      disabled={isBusy || !englishMatches}
                    />
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
                />

                {/* What the prompt is for. The project chosen last is waiting next time, and its
                    instructions go on the end of every prompt written in it */}
                <div className="flex flex-col gap-3">
                  {!projectsOff && (
                    <>
                      <div className="flex flex-wrap items-end gap-2">
                        <label htmlFor="prompt-project" className="flex min-w-0 flex-1 flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-outline">
                          Project
                          <select
                            id="prompt-project"
                            value={currentProjectId ?? NO_PROJECT}
                            onChange={(event) => formStore.update({ projectId: event.target.value === NO_PROJECT ? null : event.target.value })}
                            disabled={isGenerating}
                            className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60"
                          >
                            <option value={NO_PROJECT}>{PROMPT_PROJECT_MESSAGES.none}</option>
                            {/* The client is named too: two clients may each have a "Website" project,
                                and a completed one is still worth writing a prompt for */}
                            {(projects.projects ?? []).map((project) => (
                              <option key={project.id} value={project.id}>
                                {project.clientName ? `${project.name} — ${project.clientName}` : project.name}
                                {project.status === "completed" ? " (completed)" : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                        {/* Projects are made under their client, so this goes to Clients Management */}
                        <Link
                          href={CLIENTS_TOOL.href}
                          title={PROMPT_PROJECT_MESSAGES.manageHint}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-outline-variant bg-white px-3 py-2.5 text-[13px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                        >
                          <FolderKanban size={14} aria-hidden="true" />
                          {PROMPT_PROJECT_MESSAGES.manage}
                        </Link>
                      </div>
                      {selectedProject && !isTemporary && (
                        <p className="text-[12px] leading-relaxed text-on-surface-variant">{PROMPT_PROJECT_MESSAGES.filedInFolder}</p>
                      )}
                      {projects.projects?.length === 0 && (
                        <p className="text-[12px] leading-relaxed text-on-surface-variant">{PROMPT_PROJECT_MESSAGES.empty}</p>
                      )}
                      {selectedProject?.instructions && (
                        <p className="text-[12px] leading-relaxed text-on-surface-variant">
                          <span className="font-semibold text-on-surface">This project&apos;s instructions</span> go on the end of the prompt:{" "}
                          <span className="italic">{selectedProject.instructions.slice(0, 160)}</span>
                          {selectedProject.instructions.length > 160 && "..."}
                        </p>
                      )}
                      {projects.error && (
                        <p role="alert" className="text-[12px] text-error">
                          {projects.error}
                        </p>
                      )}
                    </>
                  )}
                  {/* Keeping a prompt or not is its own choice, so a one-off can still be written
                      for a project, and a prompt with no project is kept like any other */}
                  <label className="flex items-start gap-2 text-[13px] text-on-surface">
                    <input
                      type="checkbox"
                      checked={isTemporary}
                      onChange={(event) => formStore.update({ isTemporary: event.target.checked })}
                      disabled={isGenerating}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                    />
                    <span>
                      Use this prompt once, don&apos;t save it
                      <span className="block text-[12px] text-on-surface-variant">
                        It stays on this page to copy, and is never written to your saved prompts.
                      </span>
                    </span>
                  </label>
                </div>

                {formError && (
                  <p role="alert" className="text-[12px] text-error">
                    {formError}
                  </p>
                )}

                {/* The prompt is written from what is in the box; the second button only reads that
                    description back in English, and the panel above then offers to write from it */}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => submit()}
                    disabled={isBusy}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Sparkles size={16} aria-hidden="true" />
                    {isGenerating ? "Writing your prompt..." : "Create Prompt"}
                  </button>
                  <button
                    type="button"
                    onClick={readInEnglish}
                    disabled={isBusy}
                    className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-outline-variant bg-white px-4 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Languages size={16} aria-hidden="true" />
                    {isReadingEnglish ? PROMPT_CREATOR_MESSAGES.englishWorking : PROMPT_CREATOR_MESSAGES.englishButton}
                  </button>
                </div>
              </section>

              <ResultCard
                title="Your Prompt"
                status={status}
                error={error}
                onRetry={() => submit()}
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

    </div>
  )
}
