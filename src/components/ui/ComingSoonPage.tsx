"use client"

import React, { useState } from "react"
import { Hammer } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { UPCOMING_MESSAGES } from "@/constants/upcomingAreas"
import { comingSoonTool } from "@/constants/comingSoonTools"
import { TOOL_GROUPS } from "@/constants/linkedinTools"

interface ComingSoonPageProps {
  // Which tool this page belongs to, and which of its two pages it is
  toolId: string
  page: "create" | "history"
}

/**
 * Every page of a tool that is on the sidebar but not built yet (`comingSoon` on the tool), at the
 * owner's request: the app around it as on any page, and in the middle of the page the tool's icon,
 * which page this is, **Coming soon** and **Under development**, so a click never lands on nothing.
 */
export const ComingSoonPage: React.FC<ComingSoonPageProps> = ({ toolId, page }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const tool = comingSoonTool(toolId)
  const Icon = tool.icon
  const heading = page === "history" && tool.view ? tool.view.heading : tool.title
  const areaLabel = TOOL_GROUPS.find((group) => group.id === tool.group)?.label ?? ""

  return (
    <div className="font-body-md text-body-md flex h-screen min-h-screen overflow-hidden bg-background text-on-surface">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setIsSidebarOpen(true)} isSidebarCollapsed={isCollapsed} onToggleCollapse={toggleCollapsed} />

        <main className="flex flex-1 items-center justify-center overflow-y-auto overflow-x-hidden bg-background p-4 md:p-6">
          <section
            aria-labelledby="coming-soon-heading"
            className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest px-6 py-10 text-center shadow-sm"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-sm">
              <Icon size={30} aria-hidden="true" />
            </span>
            <p className="text-[12px] font-bold uppercase tracking-[0.11em] text-primary">{areaLabel}</p>
            <h1 id="coming-soon-heading" className="text-2xl font-bold text-on-surface">
              {heading}
            </h1>
            <p className="text-lg font-semibold text-on-surface">{UPCOMING_MESSAGES.comingSoon}</p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-fixed px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-on-secondary-fixed-variant">
              <Hammer size={13} aria-hidden="true" />
              {UPCOMING_MESSAGES.underDevelopment}
            </span>
            <p className="text-[14px] leading-6 text-on-surface-variant">
              {tool.title} is being built. It will be ready here as soon as it is done.
            </p>
          </section>
        </main>
      </div>
    </div>
  )
}
