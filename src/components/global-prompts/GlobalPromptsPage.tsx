"use client"

import React, { useState } from "react"
import { FilePenLine, Lock, type LucideIcon } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { GlobalPromptCard } from "@/components/global-prompts/GlobalPromptCard"
import { GlobalPromptsModal } from "@/components/global-prompts/GlobalPromptsModal"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import type { GlobalPromptId } from "@/constants/globalPrompts"

// undefined: editor closed; null: open on the first prompt; an id: open on that prompt
type EditorState = GlobalPromptId | null | undefined

interface PromptCardsProps {
  // What the note says about these prompts and who they reach
  note: string
  prompts: readonly { id: GlobalPromptId; label: string; description: string }[]
  // Where they are read and saved, which is what decides who may change them
  endpoint: string
  // Told when the editor closes, so a page can read again what a save changed (My AI Profile's search line)
  onEditorClosed?: () => void
}

/**
 * A set of global prompts, each as a card that opens the editor on its own tab, under a note
 * saying who they reach and an Update Prompt button. My AI Profile shows its own under the Profile
 * Info tab; Administration → Global AI Prompts shows the ones only an admin may change.
 */
export const PromptCards: React.FC<PromptCardsProps> = ({ note, prompts, endpoint, onEditorClosed }) => {
  const [editor, setEditor] = useState<EditorState>(undefined)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <p className="flex min-w-0 flex-1 items-start gap-2 rounded-xl border border-outline-variant/60 bg-surface-container-low px-4 py-3 text-[13px] leading-relaxed text-on-surface-variant">
          <Lock size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
          <span>{note}</span>
        </p>
        <button
          type="button"
          onClick={() => setEditor(null)}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high sm:shrink-0"
        >
          <FilePenLine size={16} aria-hidden="true" />
          Update Prompt
        </button>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {prompts.map((prompt) => (
          <GlobalPromptCard key={prompt.id} id={prompt.id} label={prompt.label} description={prompt.description} onEdit={setEditor} />
        ))}
      </div>
      {editor !== undefined && (
        <GlobalPromptsModal
          prompts={prompts}
          endpoint={endpoint}
          initialPrompt={editor}
          onClose={() => {
            setEditor(undefined)
            onEditorClosed?.()
          }}
        />
      )}
    </div>
  )
}

interface GlobalPromptsPageProps {
  heading: string
  intro: string
  icon: LucideIcon
  children: React.ReactNode
}

/** The page around a set of prompts: the sidebar, the header, a heading and what the page holds. */
export const GlobalPromptsPage: React.FC<GlobalPromptsPageProps> = ({ heading, intro, icon: Icon, children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()

  return (
    <div className="font-body-md text-body-md flex h-screen min-h-screen overflow-hidden bg-background text-on-surface">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setIsSidebarOpen(true)} isSidebarCollapsed={isCollapsed} onToggleCollapse={toggleCollapsed} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 md:p-6 lg:p-8">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-2xl font-bold text-on-surface">
                <Icon size={24} className="shrink-0 text-primary" aria-hidden="true" />
                {heading}
              </h1>
              <p className="mt-1 text-sm text-on-surface-variant">{intro}</p>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
