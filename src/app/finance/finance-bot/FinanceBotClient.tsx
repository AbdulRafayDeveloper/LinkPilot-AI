"use client"

import React, { useCallback, useState } from "react"
import Link from "next/link"
import { Info, UserRound } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { AiChatPanel } from "@/components/ui/AiChatPanel"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { GLOBAL_PROMPTS_LINK } from "@/constants/globalPrompts"
import { FINANCE_BOT_CHAT_ENDPOINT, FINANCE_BOT_MESSAGES, FINANCE_BOT_SUGGESTIONS, FINANCE_BOT_TOOL, FINANCE_QUESTION_MAX_LENGTH } from "@/constants/financeBot"
import type { FinanceChatHistory, FinanceChatMessage } from "@/types/financeBot"

const questionMessage = (text: string): FinanceChatMessage => ({
  id: `you-${Date.now()}`,
  role: "you",
  text,
  sources: [],
  fromProfile: false,
  provider: null,
  createdAt: new Date().toISOString(),
})

const describeAnswer = (message: FinanceChatMessage) =>
  message.fromProfile ? FINANCE_BOT_MESSAGES.fromProfile(message.sources.slice(0, 3).join(", ")) : FINANCE_BOT_MESSAGES.notFromProfile

/**
 * Finance Bot: a chat about the person's own money and investments, every answer shaped by their My AI
 * Profile. The chat itself is the shared AiChatPanel (typed or spoken questions, answers written as
 * they arrive, copy, full screen, clear); this page adds what only it needs: a line asking the person
 * to fill their profile while it has nothing to read, and that the guidance is not licensed advice.
 */
export default function FinanceBotClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const [hasProfile, setHasProfile] = useState(true)
  const Icon = FINANCE_BOT_TOOL.icon

  const readHistory = useCallback((history: FinanceChatHistory) => {
    setHasProfile(history.hasProfile)
    return { messages: history.messages, isReady: true }
  }, [])

  return (
    <div className="font-body-md text-body-md flex h-screen min-h-screen overflow-hidden bg-background text-on-surface">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setIsSidebarOpen(true)} isSidebarCollapsed={isCollapsed} onToggleCollapse={toggleCollapsed} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <div className="mx-auto flex max-w-[1100px] flex-col gap-4 p-4 md:p-6 lg:min-h-full lg:p-8">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-2xl font-bold text-on-surface">
                <Icon size={24} className="shrink-0 text-primary" aria-hidden="true" />
                {FINANCE_BOT_TOOL.title}
              </h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                Your own guide to saving and investing: where to put your money, a roadmap step by step, the platforms to use and what each term means, all
                written for you from your My AI Profile.
              </p>
            </div>

            {!hasProfile && (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-secondary/40 bg-secondary-container px-4 py-3 text-[13px] text-on-secondary-container">
                <UserRound size={16} className="shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">{FINANCE_BOT_MESSAGES.noProfile}</span>
                <Link href={GLOBAL_PROMPTS_LINK.href} className="inline-flex min-h-6 items-center font-semibold underline underline-offset-2">
                  {FINANCE_BOT_MESSAGES.openProfile}
                </Link>
              </p>
            )}

            <AiChatPanel<FinanceChatMessage, FinanceChatHistory>
              endpoint={FINANCE_BOT_CHAT_ENDPOINT}
              transcribeFor="finance-bot"
              title="Ask the Finance Bot"
              icon={Icon}
              subtitle={FINANCE_BOT_MESSAGES.subtitle}
              readHistory={readHistory}
              questionMessage={questionMessage}
              describeAnswer={describeAnswer}
              emptyText={FINANCE_BOT_MESSAGES.empty}
              pendingText={FINANCE_BOT_MESSAGES.pending}
              placeholder={FINANCE_BOT_MESSAGES.placeholder}
              inputLabel={FINANCE_BOT_MESSAGES.inputLabel}
              clearDescription={FINANCE_BOT_MESSAGES.clearDescription}
              maxQuestionLength={FINANCE_QUESTION_MAX_LENGTH}
              suggestions={FINANCE_BOT_SUGGESTIONS}
              tall
            />

            <p className="flex items-start gap-2 px-1 text-[12px] text-on-surface-variant">
              <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              {FINANCE_BOT_MESSAGES.disclaimer}
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
