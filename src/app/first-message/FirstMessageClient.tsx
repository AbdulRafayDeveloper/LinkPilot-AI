"use client"

import React, { useRef, useState } from "react"
import { Hand, Send } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { GeneratedResultPanel } from "@/components/ui/GeneratedResultPanel"
import { ProfileTuneForm } from "@/components/outreach/ProfileTuneForm"
import { AboutMeNotice, AnalysisDetails } from "@/components/outreach/OutreachResultExtras"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { ResetButton } from "@/components/ui/ResetButton"
import { useDummyHandoff } from "@/hooks/useDummyHandoff"
import { createGenerationRequest, useGenerationRequest } from "@/hooks/useGenerationRequest"
import { createToolStore, useToolStore } from "@/lib/toolStore"
import {
  DEFAULT_FIRST_MESSAGE_TUNE,
  FIRST_MESSAGE_MESSAGES,
  FIRST_MESSAGE_PROFILE_MAX_LENGTH,
  FIRST_MESSAGE_TEXT_TUNES,
  getTuneLabel,
  type FirstMessageTuneId,
} from "@/constants/firstMessage"
import { DEFAULT_OUTREACH_FORMAT, VOICE_TUNE, VOICE_TUNE_ID, type OutreachFormatId } from "@/constants/outreachTunes"
import { describeVoiceNote } from "@/lib/voiceNote"
import type { GeneratedFirstMessage } from "@/types/firstMessage"

const GENERATE_ENDPOINT = "/api/first-messages/generate"

interface GeneratePayload {
  profileData: string
  tune: FirstMessageTuneId
}

// Inputs and the result outlive the page, so they're still here after visiting another tool
const formStore = createToolStore(
  "first-message:form",
  {
    profileData: "",
    // The tone of a written message; the voice note has one tone of its own, so it is not kept here
    tune: DEFAULT_FIRST_MESSAGE_TUNE as FirstMessageTuneId | null,
    format: DEFAULT_OUTREACH_FORMAT as OutreachFormatId,
  },
  // v2: the tones were replaced, so a tone saved by v1 no longer exists. v3: text or a voice note
  { version: 3 }
)
const generation = createGenerationRequest<GeneratePayload, GeneratedFirstMessage>(
  "first-message",
  GENERATE_ENDPOINT,
  FIRST_MESSAGE_MESSAGES.generationFailed,
  { resultVersion: 2 }
)

export default function FirstMessageClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  // The tab the prompts modal opens on; null means the modal is closed
  const { profileData, tune, format } = useToolStore(formStore)
  // A voice note is one script with one tone of its own; text keeps the tone the user last chose
  const isVoice = format === "voice"
  const chosenTune = isVoice ? VOICE_TUNE_ID : tune
  const [formError, setFormError] = useState<string | null>(null)
  const profileInputRef = useRef<HTMLTextAreaElement>(null)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const { status, result, error, generate, reset } = useGenerationRequest(generation)
  const isGenerating = status === "loading"
  const canReset = profileData !== "" || status !== "idle"

  const submit = () => {
    if (isGenerating) return
    if (!profileData.trim()) {
      setFormError(FIRST_MESSAGE_MESSAGES.missingProfile)
      profileInputRef.current?.focus()
      return
    }
    if (!chosenTune) {
      setFormError(FIRST_MESSAGE_MESSAGES.missingTune)
      return
    }
    setFormError(null)
    generate({ profileData, tune: chosenTune })
  }

  // A dummy profile replaces the input, and the message written for the previous profile goes with it
  const loadDummyProfile = ({ profile }: Record<string, string>) => {
    formStore.update({ profileData: profile ?? "" })
    reset()
    setFormError(null)
  }

  // Sample data comes from the Dummy Data module (Administration), which opens this tool with
  // an item already chosen; the tool itself no longer carries a button for it
  useDummyHandoff("profiles", loadDummyProfile)

  // Clears the profile and the result; the chosen tone stays for the next profile
  const resetTool = () => {
    formStore.update({ profileData: "" })
    setFormError(null)
    reset()
    profileInputRef.current?.focus()
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
          <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-5 lg:min-h-full">
            {/* Page header */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
                  <Hand size={24} className="text-primary shrink-0" aria-hidden="true" />
                  First Message
                </h1>
                <p className="text-sm text-on-surface-variant mt-1">
                  Generate a personalized first LinkedIn message from someone&apos;s profile information.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 xl:shrink-0">
                <ResetButton onReset={resetTool} disabled={!canReset} />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-5 lg:flex-1">
              <ProfileTuneForm
                idPrefix="first-message"
                profileData={profileData}
                onProfileChange={(value) => {
                  formStore.update({ profileData: value })
                  if (formError === FIRST_MESSAGE_MESSAGES.missingProfile) setFormError(null)
                }}
                profileMaxLength={FIRST_MESSAGE_PROFILE_MAX_LENGTH}
                profileInputRef={profileInputRef}
                tunes={isVoice ? [VOICE_TUNE] : FIRST_MESSAGE_TEXT_TUNES}
                tuneLegend="Tone"
                tune={chosenTune}
                onTuneChange={(nextTune) => {
                  // In the voice format there is only its own tone, so nothing else can be chosen
                  if (nextTune !== VOICE_TUNE_ID) formStore.update({ tune: nextTune })
                  if (formError === FIRST_MESSAGE_MESSAGES.missingTune) setFormError(null)
                }}
                format={format}
                onFormatChange={(nextFormat) => {
                  formStore.update({ format: nextFormat })
                  setFormError(null)
                }}
                formError={formError}
                profileInvalid={formError === FIRST_MESSAGE_MESSAGES.missingProfile}
                tuneInvalid={formError === FIRST_MESSAGE_MESSAGES.missingTune}
                isGenerating={isGenerating}
                onSubmit={submit}
                submitLabel="Generate First Message"
                generatingLabel="Generating First Message..."
                submitIcon={Send}
              />

              <GeneratedResultPanel
                title="Generated First Message"
                status={status}
                text={result?.message ?? null}
                editScope="first-message"
                textLabel="First message"
                error={error}
                onRetry={submit}
                idleIcon={Hand}
                idleText="Paste the person's profile, pick a tone, and generate a personalized first message."
                loadingText="Writing your first message..."
                copyLabel="Copy first message"
                copyButtonText="Copy Message"
                warning={result?.warning}
                meta={
                  result && (
                    <>
                      {getTuneLabel(result.tune)}
                      {result.tune === VOICE_TUNE_ID ? ` · ${describeVoiceNote(result.wordCount ?? 0)}` : " tone"}
                    </>
                  )
                }
                source={result}
              >
                {result && !result.usedSenderProfile && (
                  <AboutMeNotice outputName="message" />
                )}
                {result && <AnalysisDetails keyDetail={result.analysis.keyDetail} senderLink={result.analysis.senderLink} />}
              </GeneratedResultPanel>
            </div>
          </div>
        </main>
      </div>

    </div>
  )
}
