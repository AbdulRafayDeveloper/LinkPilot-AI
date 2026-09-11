"use client"

import React, { useState } from "react"
import { FilePenLine, Globe, Lock } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { GlobalPromptCard } from "@/components/global-prompts/GlobalPromptCard"
import { GlobalPromptsModal } from "@/components/global-prompts/GlobalPromptsModal"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { GLOBAL_PROMPTS, type GlobalPromptId } from "@/constants/globalPrompts"
import { PROMPT_ACCESS_SESSION_HOURS } from "@/constants/promptAccess"

// undefined: editor closed; null: open on the first prompt; an id: open on that prompt
type EditorState = GlobalPromptId | null | undefined

export default function GlobalPromptsClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [editor, setEditor] = useState<EditorState>(undefined)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()

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
          <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-5">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
                  <Globe size={24} className="text-primary shrink-0" aria-hidden="true" />
                  Global AI Prompts
                </h1>
                <p className="text-sm text-on-surface-variant mt-1">
                  Shared prompts for LinkPilot AI, kept in one place.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditor(null)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-outline-variant bg-white text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-colors sm:shrink-0"
              >
                <FilePenLine size={16} aria-hidden="true" />
                Update Prompt
              </button>
            </div>

            <p className="flex items-start gap-2 bg-surface-container-low border border-outline-variant/60 text-on-surface-variant rounded-xl px-4 py-3 text-[13px] leading-relaxed">
              <Lock size={15} className="shrink-0 mt-0.5 text-primary" aria-hidden="true" />
              <span>
                The Humanization prompt rewrites the results of all 8 LinkedIn tools; Rafay Profile Info is saved for future use. Viewing or editing them needs the prompt
                password, which stays unlocked in this browser for {PROMPT_ACCESS_SESSION_HOURS} hours.
              </span>
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {GLOBAL_PROMPTS.map((prompt) => (
                <GlobalPromptCard
                  key={prompt.id}
                  id={prompt.id}
                  label={prompt.label}
                  description={prompt.description}
                  onEdit={setEditor}
                />
              ))}
            </div>
          </div>
        </main>
      </div>

      {editor !== undefined && <GlobalPromptsModal initialPrompt={editor} onClose={() => setEditor(undefined)} />}
    </div>
  )
}
