"use client"

import React from "react"
import Image from "next/image"
import { Menu, Search, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { SITE_NAME } from "@/config/site"

interface HeaderProps {
  onOpenSidebar: () => void
  searchPlaceholder?: string
  isSidebarCollapsed?: boolean
  onToggleCollapse?: () => void
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSidebar,
  searchPlaceholder = "Search resources...",
  isSidebarCollapsed = false,
  onToggleCollapse,
}) => {
  return (
    <header className="w-full h-16 bg-surface border-b border-outline-variant flex justify-between items-center px-4 md:px-8 lg:px-margin-desktop flex-shrink-0">
      <div className="flex items-center gap-2 md:gap-4">
        {/* Hamburger Button for Mobile/Tablet */}
        <button
          onClick={onOpenSidebar}
          className="lg:hidden p-2 hover:bg-surface-container rounded-lg text-on-surface-variant transition-colors"
          aria-label="Open Sidebar"
        >
          <Menu size={20} />
        </button>

        {/* Sidebar Toggle Button for Desktop - ChatGPT Style */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="hidden lg:block p-2 hover:bg-surface-container rounded-lg text-on-surface-variant transition-colors mr-2"
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
        )}

        <h2 className="font-headline-md text-base md:text-headline-md font-extrabold text-primary">{SITE_NAME}</h2>
      </div>

      <div className="flex items-center gap-4">
        {/* AI Status Indicator inside Navbar */}
        <div className="relative group cursor-help flex items-center gap-2 bg-white ambient-card-shadow rounded-full px-3 py-1.5 border border-outline-variant text-[11px] font-semibold text-primary">
          <span className="flex h-1.5 w-1.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
          </span>
          <span>AI Ready</span>

          {/* Tooltip Hover info Box */}
          <div className="absolute right-0 top-9 hidden group-hover:block bg-neutral-950 text-neutral-200 text-xs rounded-xl p-3 shadow-2xl border border-neutral-800 min-w-[240px] leading-relaxed z-50 font-normal">
            <p className="font-bold text-primary mb-1 text-left">AI Services Operational</p>
            <ul className="list-disc ml-4 text-left text-[10px] space-y-1 text-neutral-400">
              <li>OpenAI completions & embeddings active</li>
              <li>Google Gemini fallback active</li>
              <li>Chroma Vector DB connected</li>
              <li>RAG & Web Search pipelines online</li>
            </ul>
          </div>
        </div>

        {/* Profile */}
        <div className="flex items-center gap-3">
          <span className="text-right hidden lg:block mr-1">
            <p className="font-label-md text-label-md text-on-surface font-semibold">User</p>
          </span>
          <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold overflow-hidden relative">
            <Image
              className="w-full h-full object-cover"
              alt="A professional portrait of a user"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDIZ_qO5p3BjtOlqacgvw_Bqzj91-40mRKhjtSrUgI0-GL7TSPBgYKDyMUEwgH_BDiXaGxqJUEv37DcVaGzzHsfEodeZgdlwnyNnoudJGiHFV_ECWUENu6q3otk3drfFClD9ezU0kbI0-kV3CtiNiwJ5T7ursAhxHHF5T4d20UcogXzeV1wGXSapofDtEQpZzXY_2zI9v6d9_KzStgA1ZW_aHP5a9_morucOjaeV1h2lZUbA-XXCdto"
              width={36}
              height={36}
              priority
            />
          </div>
        </div>
      </div>
    </header>
  )
}
