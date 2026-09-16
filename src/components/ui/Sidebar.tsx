"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Loader2, X } from "lucide-react"
import { BrandLogo } from "./BrandLogo"
import { APP_TOOLS, TOOL_GROUPS, type LinkedInTool } from "@/constants/linkedinTools"
import { GLOBAL_PROMPTS_LINK } from "@/constants/globalPrompts"
import { markToolSeen, useToolActivity, type ActivityState } from "@/lib/toolActivity"

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  isCollapsed?: boolean
}

type NavLink = Pick<LinkedInTool, "title" | "description" | "icon" | "href">

// What the collapsed rail's tooltip shows, and where
interface RailHint {
  title: string
  detail: string
  top: number
}

const ACTIVITY_TEXT: Record<ActivityState, string> = {
  running: "Writing in the background",
  ready: "Result ready",
  failed: "Didn't finish",
}

// Collapsed applies on desktop only (lg:); the mobile drawer always shows the full list
const whenCollapsed = (isCollapsed: boolean, classes: string) => (isCollapsed ? classes : "")
const isDesktop = () => window.matchMedia("(min-width: 1024px)").matches

// A spinner while the tool writes in the background, a dot when its result (or error) is waiting
const ActivityMark: React.FC<{ state: ActivityState; className?: string }> = ({ state, className = "" }) =>
  state === "running" ? (
    <Loader2 size={13} className={`animate-spin text-primary ${className}`} aria-hidden="true" />
  ) : (
    <span
      className={`h-2 w-2 rounded-full ring-2 ring-surface-container-lowest ${state === "ready" ? "bg-primary" : "bg-error"} ${className}`}
      aria-hidden="true"
    />
  )

interface SidebarLinkProps {
  link: NavLink
  isActive: boolean
  isCollapsed: boolean
  activity: ActivityState | undefined
  onNavigate: () => void
  onHint: (hint: RailHint | null) => void
}

// One navigation row: an icon tile, the name and a one-line description. Collapsed, only the
// tile shows; the name stays for screen readers and appears in the rail tooltip.
const SidebarLink: React.FC<SidebarLinkProps> = ({ link, isActive, isCollapsed, activity, onNavigate, onHint }) => {
  const { title, description, icon: Icon, href } = link
  const showHint = (event: React.SyntheticEvent<HTMLElement>) => {
    if (!isCollapsed || !isDesktop()) return
    const rect = event.currentTarget.getBoundingClientRect()
    onHint({ title, detail: activity ? ACTIVITY_TEXT[activity] : description, top: rect.top + rect.height / 2 })
  }

  return (
    <li className="relative">
      {isActive && <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary" aria-hidden="true" />}
      <Link
        href={href}
        onClick={onNavigate}
        onMouseEnter={showHint}
        onFocus={showHint}
        onMouseLeave={() => onHint(null)}
        onBlur={() => onHint(null)}
        aria-current={isActive ? "page" : undefined}
        className={`group flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${whenCollapsed(
          isCollapsed,
          "lg:justify-center lg:px-0"
        )} ${isActive ? "bg-primary-fixed/45" : "hover:bg-surface-container-low"}`}
      >
        <span
          className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 ${
            isActive
              ? "bg-primary text-on-primary shadow-sm"
              : "bg-surface-container-low text-on-surface-variant group-hover:bg-surface-container-lowest group-hover:text-primary group-hover:shadow-sm"
          }`}
        >
          <Icon size={16} aria-hidden="true" />
          {activity && isCollapsed && <ActivityMark state={activity} className="absolute -right-1 -top-1 hidden lg:block" />}
        </span>
        <span className={`min-w-0 flex-1 ${whenCollapsed(isCollapsed, "lg:sr-only")}`}>
          <span className={`block truncate text-[13px] leading-tight ${isActive ? "font-semibold text-on-surface" : "font-medium text-on-surface"}`}>
            {title}
          </span>
          <span className="mt-0.5 block truncate text-[11px] leading-tight text-outline">{description}</span>
        </span>
        {activity && (
          <span className={`flex shrink-0 items-center ${whenCollapsed(isCollapsed, "lg:hidden")}`}>
            <ActivityMark state={activity} />
          </span>
        )}
        {activity && <span className="sr-only">({ACTIVITY_TEXT[activity]})</span>}
      </Link>
    </li>
  )
}

/**
 * App navigation: the brand, the 8 LinkedIn tools grouped by what they help with, and Global
 * AI Prompts pinned at the bottom. A drawer on small screens; on desktop a full column that
 * collapses to an icon rail. Every tool shows when it's writing in the background or has a
 * result waiting.
 */
export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, isCollapsed = false }) => {
  const pathname = usePathname()
  const activity = useToolActivity()
  const [hint, setHint] = useState<RailHint | null>(null)
  const activityOf = (href: string) => activity.find((entry) => entry.href === href)?.state

  // Opening a tool means its finished result has been seen
  useEffect(() => {
    markToolSeen(pathname)
  }, [pathname])

  const renderLink = (link: NavLink) => (
    <SidebarLink
      key={link.href}
      link={link}
      isActive={pathname === link.href}
      isCollapsed={isCollapsed}
      activity={pathname === link.href ? undefined : activityOf(link.href)}
      onNavigate={onClose}
      onHint={setHint}
    />
  )

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
        className={`fixed inset-y-0 left-0 z-[45] flex h-screen w-[280px] flex-shrink-0 flex-col border-r border-outline-variant/80 bg-surface-container-lowest transition-all duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0 shadow-xl lg:shadow-none" : "-translate-x-full"
        } ${isCollapsed ? "lg:w-[76px]" : "lg:w-[280px]"}`}
      >
        {/* Brand: as tall as the header, so both bottom borders line up */}
        <div
          className={`flex h-16 shrink-0 items-center justify-between gap-2 border-b border-outline-variant/80 px-4 ${whenCollapsed(
            isCollapsed,
            "lg:justify-center lg:px-0"
          )}`}
        >
          <BrandLogo wordmarkClassName={whenCollapsed(isCollapsed, "lg:sr-only")} priority />
          <button
            onClick={onClose}
            className="lg:hidden rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high"
            aria-label="Close Sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <nav
          aria-label="Main"
          onScroll={() => setHint(null)}
          className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4"
        >
          {TOOL_GROUPS.map((group, index) => (
            <div key={group.id} className={index > 0 ? "mt-4" : ""}>
              {/* Collapsed, a thin line separates the groups instead of their names */}
              {index > 0 && <div className={`mx-2 mb-3 hidden h-px bg-outline-variant/70 ${whenCollapsed(isCollapsed, "lg:block")}`} aria-hidden="true" />}
              <p
                className={`mb-1.5 px-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-outline ${whenCollapsed(isCollapsed, "lg:sr-only")}`}
              >
                {group.label}
              </p>
              <ul className="space-y-0.5">{APP_TOOLS.filter((tool) => tool.group === group.id).map(renderLink)}</ul>
            </div>
          ))}
        </nav>

        {/* Global AI Prompts: shared settings for every tool, not a LinkedIn tool */}
        <div className="shrink-0 border-t border-outline-variant/80 px-3 py-3">
          <ul>{renderLink(GLOBAL_PROMPTS_LINK)}</ul>
        </div>
      </aside>

      {/* The collapsed rail's tooltip, outside the scrolling list so it's never clipped */}
      {hint && isCollapsed && (
        <div
          aria-hidden="true"
          style={{ top: hint.top }}
          className="pointer-events-none fixed left-[84px] z-[60] hidden -translate-y-1/2 rounded-lg bg-inverse-surface px-3 py-2 shadow-lg lg:block"
        >
          <p className="whitespace-nowrap text-xs font-semibold text-inverse-on-surface">{hint.title}</p>
          <p className="mt-0.5 whitespace-nowrap text-[11px] text-inverse-on-surface/70">{hint.detail}</p>
        </div>
      )}
    </>
  )
}
