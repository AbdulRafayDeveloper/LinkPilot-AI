"use client"

import React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SquareArrowOutUpRight, X } from "lucide-react"
import { SITE_NAME } from "@/config/site"
import { LINKEDIN_TOOLS, type LinkedInTool } from "@/constants/linkedinTools"
import { GLOBAL_PROMPTS_LINK } from "@/constants/globalPrompts"

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  isCollapsed?: boolean
}

interface SidebarLinkProps {
  link: Pick<LinkedInTool, "title" | "description" | "icon" | "href">
  isActive: boolean
  onNavigate: () => void
}

// One navigation row: the page link, plus a separate "open in new tab" link beside it
const SidebarLink: React.FC<SidebarLinkProps> = ({ link: { title, description, icon: Icon, href }, isActive, onNavigate }) => (
  <li className="relative">
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={`w-full flex items-center gap-3 pl-2.5 pr-10 py-2 rounded-lg transition-colors duration-200 ${
        isActive ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-container-high"
      }`}
    >
      <Icon size={18} className="shrink-0" aria-hidden="true" />
      <span className="min-w-0">
        <span className={`block text-sm leading-tight truncate ${isActive ? "font-semibold" : "font-medium"}`}>{title}</span>
        <span
          className={`block text-[11px] leading-tight mt-0.5 truncate ${isActive ? "text-on-primary-container/80" : "text-outline"}`}
        >
          {description}
        </span>
      </span>
    </Link>
    {/* A real link, so Ctrl/⌘+click and middle-click open the page in a background tab */}
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${title} in a new tab`}
      title="Open in a new tab (Ctrl/⌘+click or middle-click to stay on this page)"
      className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        isActive
          ? "text-on-primary-container/70 hover:text-on-primary-container hover:bg-white/15"
          : "text-outline hover:text-primary hover:bg-surface-container"
      }`}
    >
      <SquareArrowOutUpRight size={14} aria-hidden="true" />
    </a>
  </li>
)

/**
 * App navigation: the logo, the 8 LinkedIn tools and the Global AI Prompts module. A drawer
 * on small screens, a collapsible column on desktop. The list scrolls if a screen is too short.
 */
export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, isCollapsed = false }) => {
  const pathname = usePathname()

  return (
    <>
      {/* Mobile Sidebar Overlay Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[45] lg:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      <aside
        className={`h-screen flex-shrink-0 bg-surface-container-lowest border-r border-outline-variant flex flex-col transition-all duration-300 ease-in-out z-[45] ${
          isOpen
            ? "translate-x-0 fixed inset-y-0 left-0 w-[280px] p-stack-md"
            : isCollapsed
            ? "lg:w-0 lg:p-0 lg:overflow-hidden lg:border-none -translate-x-full lg:translate-x-0"
            : "-translate-x-full fixed inset-y-0 left-0 w-[280px] lg:translate-x-0 lg:static p-stack-md"
        }`}
      >
        <div
          className={`flex flex-col h-full min-h-0 ${
            isCollapsed ? "lg:opacity-0 lg:pointer-events-none" : "opacity-100"
          } transition-opacity duration-200`}
        >
          {/* Logo Area & Close Button */}
          <div className="flex items-center justify-between mb-5 px-2 shrink-0">
            <Link href={LINKEDIN_TOOLS[0].href} className="flex flex-col gap-2 hover:opacity-90 transition-opacity">
              <Image alt={`${SITE_NAME} Logo`} className="w-10 h-10 object-contain" src="/logo.png" width={40} height={40} priority />
              <div>
                <h1 className="font-headline-md text-[18px] font-bold text-primary leading-tight">LinkPilot</h1>
                <p className="font-label-sm text-[10px] text-outline uppercase tracking-wider">AI</p>
              </div>
            </Link>
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 hover:bg-surface-container-high rounded-lg text-on-surface-variant transition-colors"
              aria-label="Close Sidebar"
            >
              <X size={20} />
            </button>
          </div>

          <nav aria-label="Main" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            {/* LinkedIn Tools */}
            <p className="text-[10px] font-bold text-outline uppercase tracking-wider mb-2.5 px-2.5">LinkedIn Tools</p>
            <ul className="space-y-1.5">
              {LINKEDIN_TOOLS.map((tool) => (
                <SidebarLink key={tool.id} link={tool} isActive={pathname === tool.href} onNavigate={onClose} />
              ))}
            </ul>

            {/* Global AI Prompts: shared prompts, not a LinkedIn tool */}
            <ul className="mt-3 pt-3 border-t border-outline-variant/60">
              <SidebarLink link={GLOBAL_PROMPTS_LINK} isActive={pathname === GLOBAL_PROMPTS_LINK.href} onNavigate={onClose} />
            </ul>
          </nav>
        </div>
      </aside>
    </>
  )
}
