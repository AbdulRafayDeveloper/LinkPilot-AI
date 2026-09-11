"use client"

import React, { useRef, useState } from "react"
import { AlertTriangle, FilePenLine, Loader2, Sparkles, UserPlus } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { ToneSelector } from "@/components/connection-note/ToneSelector"
import { NoteResult } from "@/components/connection-note/NoteResult"
import { ConnectionNotePromptsModal } from "@/components/connection-note/ConnectionNotePromptsModal"
import { DummyDataModal } from "@/components/dummy-data/DummyDataModal"
import { DummyDataButton } from "@/components/dummy-data/DummyDataButton"
import { ResetButton } from "@/components/ui/ResetButton"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { createGenerationRequest, useGenerationRequest } from "@/hooks/useGenerationRequest"
import { createToolStore, useToolStore } from "@/lib/toolStore"
import {
  CONNECTION_NOTE_MESSAGES,
  DEFAULT_CONNECTION_NOTE_TONE,
  PROFILE_DATA_MAX_LENGTH,
  type ConnectionNoteToneId,
} from "@/constants/connectionNote"
import type { GeneratedConnectionNote } from "@/types/connectionNote"

const PROFILE_INPUT_ID = "connection-note-profile"
const FORM_ERROR_ID = "connection-note-form-error"

// Inputs and the result outlive the page, so they're still here after visiting another tool
const formStore = createToolStore(
  "connection-note:form",
  { profileData: "", tone: DEFAULT_CONNECTION_NOTE_TONE as ConnectionNoteToneId },
  { version: 1 }
)
const generation = createGenerationRequest<{ profileData: string; tone: ConnectionNoteToneId }, GeneratedConnectionNote>(
  "connection-note",
  "/api/connection-notes/generate",
  CONNECTION_NOTE_MESSAGES.generationFailed
)

export default function ConnectionNoteClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isPromptsOpen, setIsPromptsOpen] = useState(false)
  const [isDummyDataOpen, setIsDummyDataOpen] = useState(false)
  const { profileData, tone } = useToolStore(formStore)
  const [formError, setFormError] = useState<string | null>(null)
  const profileInputRef = useRef<HTMLTextAreaElement>(null)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const { status, result, error, generate, reset } = useGenerationRequest(generation)
  const isGenerating = status === "loading"
  const canReset = profileData !== "" || status !== "idle"

  const submit = () => {
    if (!profileData.trim()) {
      setFormError(CONNECTION_NOTE_MESSAGES.missingProfile)
      profileInputRef.current?.focus()
      return
    }
    setFormError(null)
    generate({ profileData, tone })
  }

  // A dummy profile replaces the input, and the note written for the previous profile goes with it
  const loadDummyProfile = ({ profile }: Record<string, string>) => {
    formStore.update({ profileData: profile ?? "" })
    reset()
    setFormError(null)
  }

  // Clears the profile and the note; the chosen tone stays for the next profile
  const resetTool = () => {
    formStore.update({ profileData: "" })
    reset()
    setFormError(null)
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
                  <UserPlus size={24} className="text-primary shrink-0" aria-hidden="true" />
                  Connection Note
                </h1>
                <p className="text-sm text-on-surface-variant mt-1">
                  Create a personalized LinkedIn connection note from a profile.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:shrink-0">
                <ResetButton onReset={resetTool} disabled={!canReset} />
                <DummyDataButton onClick={() => setIsDummyDataOpen(true)} />
                <button
                  type="button"
                  onClick={() => setIsPromptsOpen(true)}
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
                className="bg-white border border-outline-variant rounded-2xl shadow-sm p-5 flex flex-col gap-4 min-h-0"
              >
                <div className="flex flex-col flex-1 min-h-0">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label htmlFor={PROFILE_INPUT_ID} className="text-[10px] font-bold text-outline uppercase tracking-wider">
                      LinkedIn Profile Data
                    </label>
                    <span className="text-[11px] text-outline">
                      {profileData.length.toLocaleString()} / {PROFILE_DATA_MAX_LENGTH.toLocaleString()}
                    </span>
                  </div>
                  <textarea
                    ref={profileInputRef}
                    id={PROFILE_INPUT_ID}
                    value={profileData}
                    onChange={(event) => {
                      formStore.update({ profileData: event.target.value })
                      if (formError === CONNECTION_NOTE_MESSAGES.missingProfile) setFormError(null)
                    }}
                    maxLength={PROFILE_DATA_MAX_LENGTH}
                    placeholder="Paste the complete LinkedIn profile information here..."
                    aria-invalid={formError === CONNECTION_NOTE_MESSAGES.missingProfile}
                    aria-describedby={formError ? FORM_ERROR_ID : undefined}
                    className="flex-1 w-full min-h-[200px] lg:min-h-[140px] resize-none rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-[13px] leading-relaxed text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                </div>

                <ToneSelector
                  value={tone}
                  onChange={(nextTone) => formStore.update({ tone: nextTone })}
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
                    <Sparkles size={16} aria-hidden="true" />
                  )}
                  {isGenerating ? "Generating connection note..." : "Generate Connection Note"}
                </button>
              </form>

              {/* Output */}
              <NoteResult status={status} result={result} error={error} onRetry={submit} />
            </div>
          </div>
        </main>
      </div>

      {isPromptsOpen && <ConnectionNotePromptsModal initialTone={tone} onClose={() => setIsPromptsOpen(false)} />}
      {isDummyDataOpen && <DummyDataModal kind="profiles" onUse={loadDummyProfile} onClose={() => setIsDummyDataOpen(false)} />}
    </div>
  )
}
