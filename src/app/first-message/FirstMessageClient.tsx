"use client"

import React, { useRef, useState } from "react"
import { FilePenLine, Hand, Send } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { GeneratedResultPanel } from "@/components/ui/GeneratedResultPanel"
import { ProfileTuneForm } from "@/components/outreach/ProfileTuneForm"
import { AboutMeNotice, AnalysisDetails } from "@/components/outreach/OutreachResultExtras"
import { FirstMessagePromptsModal } from "@/components/first-message/FirstMessagePromptsModal"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { useGenerationRequest } from "@/hooks/useGenerationRequest"
import {
  ABOUT_ME_TAB_ID,
  DEFAULT_FIRST_MESSAGE_TUNE,
  FIRST_MESSAGE_MESSAGES,
  FIRST_MESSAGE_PROFILE_MAX_LENGTH,
  getTuneLabel,
  type FirstMessagePromptId,
  type FirstMessageTuneId,
} from "@/constants/firstMessage"
import type { GeneratedFirstMessage } from "@/types/firstMessage"

const GENERATE_ENDPOINT = "/api/first-messages/generate"

interface GeneratePayload {
  profileData: string
  tune: FirstMessageTuneId
}

export default function FirstMessageClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  // The tab the prompts modal opens on; null means the modal is closed
  const [promptsTab, setPromptsTab] = useState<FirstMessagePromptId | null>(null)
  const [profileData, setProfileData] = useState("")
  const [tune, setTune] = useState<FirstMessageTuneId | null>(DEFAULT_FIRST_MESSAGE_TUNE)
  const [formError, setFormError] = useState<string | null>(null)
  const profileInputRef = useRef<HTMLTextAreaElement>(null)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const { status, result, error, generate, reset } = useGenerationRequest<GeneratePayload, GeneratedFirstMessage>(
    GENERATE_ENDPOINT,
    FIRST_MESSAGE_MESSAGES.generationFailed
  )
  const isGenerating = status === "loading"

  const submit = () => {
    if (isGenerating) return
    if (!profileData.trim()) {
      setFormError(FIRST_MESSAGE_MESSAGES.missingProfile)
      profileInputRef.current?.focus()
      return
    }
    if (!tune) {
      setFormError(FIRST_MESSAGE_MESSAGES.missingTune)
      return
    }
    setFormError(null)
    generate({ profileData, tune })
  }

  const clearForm = () => {
    setProfileData("")
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

        <main className="flex-1 overflow-y-auto bg-[#FAF7F2] overflow-x-hidden">
          <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-5 lg:h-full">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
                  <Hand size={24} className="text-primary shrink-0" aria-hidden="true" />
                  First Message
                </h1>
                <p className="text-sm text-on-surface-variant mt-1">
                  Generate a personalized first LinkedIn message from someone&apos;s profile information.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPromptsTab(tune ?? DEFAULT_FIRST_MESSAGE_TUNE)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-outline-variant bg-white text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-colors sm:shrink-0"
              >
                <FilePenLine size={16} aria-hidden="true" />
                Update Prompt
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-5 lg:flex-1 lg:min-h-0">
              <ProfileTuneForm
                idPrefix="first-message"
                profileData={profileData}
                onProfileChange={(value) => {
                  setProfileData(value)
                  if (formError === FIRST_MESSAGE_MESSAGES.missingProfile) setFormError(null)
                }}
                profileMaxLength={FIRST_MESSAGE_PROFILE_MAX_LENGTH}
                profileInputRef={profileInputRef}
                tune={tune}
                onTuneChange={(nextTune) => {
                  setTune(nextTune)
                  if (formError === FIRST_MESSAGE_MESSAGES.missingTune) setFormError(null)
                }}
                formError={formError}
                profileInvalid={formError === FIRST_MESSAGE_MESSAGES.missingProfile}
                tuneInvalid={formError === FIRST_MESSAGE_MESSAGES.missingTune}
                isGenerating={isGenerating}
                canClear={profileData !== "" || status !== "idle"}
                onClear={clearForm}
                onSubmit={submit}
                submitLabel="Generate First Message"
                generatingLabel="Generating First Message..."
                submitIcon={Send}
              />

              <GeneratedResultPanel
                title="Generated First Message"
                status={status}
                text={result?.message ?? null}
                error={error}
                onRetry={submit}
                idleIcon={Hand}
                idleText="Paste the person's profile, pick a tune, and generate a personalized first message."
                loadingText="Writing your first message..."
                copyLabel="Copy first message"
                copyButtonText="Copy Message"
                warning={result?.warning}
                meta={
                  result && (
                    <>
                      {result.characterCount.toLocaleString()} characters · {getTuneLabel(result.tune)} tune
                    </>
                  )
                }
              >
                {result && !result.usedSenderProfile && (
                  <AboutMeNotice outputName="message" onOpenAboutMe={() => setPromptsTab(ABOUT_ME_TAB_ID)} />
                )}
                {result && <AnalysisDetails keyDetail={result.analysis.keyDetail} senderLink={result.analysis.senderLink} />}
              </GeneratedResultPanel>
            </div>
          </div>
        </main>
      </div>

      {promptsTab && <FirstMessagePromptsModal initialTab={promptsTab} onClose={() => setPromptsTab(null)} />}
    </div>
  )
}
