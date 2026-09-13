"use client"

import React, { useRef, useState } from "react"
import { FilePenLine, Mail, Send } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { ProfileTuneForm } from "@/components/outreach/ProfileTuneForm"
import { InMailResult } from "@/components/inmail/InMailResult"
import { InMailPromptsModal } from "@/components/inmail/InMailPromptsModal"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { ResetButton } from "@/components/ui/ResetButton"
import { DummyDataButton } from "@/components/dummy-data/DummyDataButton"
import { DummyDataModal } from "@/components/dummy-data/DummyDataModal"
import { createGenerationRequest, useGenerationRequest } from "@/hooks/useGenerationRequest"
import { createToolStore, useToolStore } from "@/lib/toolStore"
import { ABOUT_ME_TAB_ID } from "@/constants/outreachTunes"
import {
  DEFAULT_INMAIL_TUNE,
  INMAIL_MESSAGES,
  INMAIL_PROFILE_MAX_LENGTH,
  INMAIL_TUNES,
  type InMailPromptId,
  type InMailTuneId,
} from "@/constants/inmail"
import type { GeneratedInMail } from "@/types/inmail"

const GENERATE_ENDPOINT = "/api/inmail-messages/generate"

interface GeneratePayload {
  profileData: string
  tune: InMailTuneId
}

// Inputs and the result outlive the page, so they're still here after visiting another tool
const formStore = createToolStore(
  "inmail-message:form",
  { profileData: "", tune: DEFAULT_INMAIL_TUNE as InMailTuneId | null },
  // v2: the tones were replaced, so a tone saved by v1 no longer exists
  { version: 2 }
)
const generation = createGenerationRequest<GeneratePayload, GeneratedInMail>(
  "inmail-message",
  GENERATE_ENDPOINT,
  INMAIL_MESSAGES.generationFailed,
  { resultVersion: 2 }
)

export default function InMailClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isDummyDataOpen, setIsDummyDataOpen] = useState(false)
  // The tab the prompts modal opens on; null means the modal is closed
  const [promptsTab, setPromptsTab] = useState<InMailPromptId | null>(null)
  const { profileData, tune } = useToolStore(formStore)
  const [formError, setFormError] = useState<string | null>(null)
  const profileInputRef = useRef<HTMLTextAreaElement>(null)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const { status, result, error, generate, reset } = useGenerationRequest(generation)
  const isGenerating = status === "loading"
  const canReset = profileData !== "" || status !== "idle"

  const submit = () => {
    if (isGenerating) return
    if (!profileData.trim()) {
      setFormError(INMAIL_MESSAGES.missingProfile)
      profileInputRef.current?.focus()
      return
    }
    if (!tune) {
      setFormError(INMAIL_MESSAGES.missingTune)
      return
    }
    setFormError(null)
    generate({ profileData, tune })
  }

  // A dummy profile replaces the input, and the InMail written for the previous profile goes with it
  const loadDummyProfile = ({ profile }: Record<string, string>) => {
    formStore.update({ profileData: profile ?? "" })
    reset()
    setFormError(null)
  }

  // Clears the profile and the result; the chosen tune stays for the next profile
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

        <main className="flex-1 overflow-y-auto bg-[#FAF7F2] overflow-x-hidden">
          <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-5 lg:h-full">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
                  <Mail size={24} className="text-primary shrink-0" aria-hidden="true" />
                  InMail Message
                </h1>
                <p className="text-sm text-on-surface-variant mt-1">
                  Generate a personalized LinkedIn InMail subject and message from someone&apos;s profile information.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:shrink-0">
                <ResetButton onReset={resetTool} disabled={!canReset} />
                <DummyDataButton onClick={() => setIsDummyDataOpen(true)} />
                <button
                  type="button"
                  onClick={() => setPromptsTab(tune ?? DEFAULT_INMAIL_TUNE)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-outline-variant bg-white text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-colors"
                >
                  <FilePenLine size={16} aria-hidden="true" />
                  Update Prompt
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-5 lg:flex-1 lg:min-h-0">
              <ProfileTuneForm
                idPrefix="inmail"
                profileData={profileData}
                onProfileChange={(value) => {
                  formStore.update({ profileData: value })
                  if (formError === INMAIL_MESSAGES.missingProfile) setFormError(null)
                }}
                profileMaxLength={INMAIL_PROFILE_MAX_LENGTH}
                profileInputRef={profileInputRef}
                tunes={INMAIL_TUNES}
                tuneLegend="Tone"
                tune={tune}
                onTuneChange={(nextTune) => {
                  formStore.update({ tune: nextTune })
                  if (formError === INMAIL_MESSAGES.missingTune) setFormError(null)
                }}
                formError={formError}
                profileInvalid={formError === INMAIL_MESSAGES.missingProfile}
                tuneInvalid={formError === INMAIL_MESSAGES.missingTune}
                isGenerating={isGenerating}
                onSubmit={submit}
                submitLabel="Generate InMail"
                generatingLabel="Generating InMail..."
                submitIcon={Send}
              />

              <InMailResult
                status={status}
                result={result}
                error={error}
                onRetry={submit}
                onOpenAboutMe={() => setPromptsTab(ABOUT_ME_TAB_ID)}
              />
            </div>
          </div>
        </main>
      </div>

      {promptsTab && <InMailPromptsModal initialTab={promptsTab} onClose={() => setPromptsTab(null)} />}
      {isDummyDataOpen && (
        <DummyDataModal kind="profiles" onUse={loadDummyProfile} onClose={() => setIsDummyDataOpen(false)} />
      )}
    </div>
  )
}
