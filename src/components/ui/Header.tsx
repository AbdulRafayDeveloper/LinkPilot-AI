"use client"

import React, { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react"
import { SITE_PURPOSE } from "@/config/site"
import { ActivityIndicator } from "./ActivityIndicator"
import { BrandLogo } from "./BrandLogo"
import { ToolSwitcher } from "./ToolSwitcher"
import { UserMenu } from "./UserMenu"

interface HeaderProps {
  onOpenSidebar: () => void
  isSidebarCollapsed?: boolean
  onToggleCollapse?: () => void
}

const subscribeToNothing = () => () => {}
// The server render shows "Ctrl"; Apple devices switch to ⌘ once the page is running
const useIsApple = () => useSyncExternalStore(subscribeToNothing, () => /Mac|iPhone|iPad/.test(navigator.userAgent), () => false)

const isTextField = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || target.tagName === "TEXTAREA" || target.tagName === "INPUT")

const isShortcut = (event: KeyboardEvent, key: string) => event.key.toLowerCase() === key && (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey

/**
 * The top bar of every page: sidebar controls, what the app is for, background work on other
 * tools, a quick way to jump to any tool, and the signed-in account. Shortcuts: Ctrl/⌘+K opens the tool search,
 * Ctrl/⌘+B collapses or expands the sidebar (desktop).
 */
export const Header: React.FC<HeaderProps> = ({ onOpenSidebar, isSidebarCollapsed = false, onToggleCollapse }) => {
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false)
  const isApple = useIsApple()
  const modifier = isApple ? "⌘" : "Ctrl"
  const toggleRef = useRef(onToggleCollapse)

  useEffect(() => {
    toggleRef.current = onToggleCollapse
  }, [onToggleCollapse])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      // Another dialog (a prompt editor, say) keeps the keyboard
      if (document.querySelector('[role="dialog"]')) return
      if (isShortcut(event, "k")) {
        event.preventDefault()
        setIsSwitcherOpen(true)
      } else if (
        isShortcut(event, "b") &&
        // In a text field Ctrl/⌘+B means Bold (the result editors), not the sidebar
        !event.defaultPrevented &&
        !isTextField(event.target) &&
        toggleRef.current &&
        window.matchMedia("(min-width: 1024px)").matches
      ) {
        event.preventDefault()
        toggleRef.current()
      }
    }
    document.addEventListener("keydown", handleShortcut)
    return () => document.removeEventListener("keydown", handleShortcut)
  }, [])

  const toggleLabel = isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"

  return (
    <header className="flex h-16 w-full flex-shrink-0 items-center justify-between gap-3 border-b border-outline-variant/80 bg-surface-container-lowest px-4 md:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-2 md:gap-3">
        {/* Hamburger Button for Mobile/Tablet */}
        <button
          onClick={onOpenSidebar}
          className="lg:hidden rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container"
          aria-label="Open Sidebar"
        >
          <Menu size={20} />
        </button>

        {/* Sidebar Toggle Button for Desktop */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="hidden lg:block rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            title={`${toggleLabel} (${modifier}+B)`}
            aria-label={toggleLabel}
            aria-keyshortcuts={isApple ? "Meta+B" : "Control+B"}
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
        )}

        {/* Below lg the sidebar is a hidden drawer, so the header carries the logo */}
        <BrandLogo className="lg:hidden" wordmarkClassName="max-[359px]:sr-only" />

        <span className="hidden h-5 w-px bg-outline-variant md:block" aria-hidden="true" />
        <p className="hidden min-w-0 truncate text-sm font-semibold tracking-tight text-on-surface md:block md:text-[15px]">{SITE_PURPOSE}</p>
      </div>

      {/* Never shrinks: its parts have no room to give, so squeezing this group would push them off the
          edge. What gives instead is the line on the left, which truncates */}
      <div className="flex shrink-0 items-center gap-2">
        <ActivityIndicator />
        <button
          type="button"
          onClick={() => setIsSwitcherOpen(true)}
          aria-label="Jump to a tool"
          aria-keyshortcuts={isApple ? "Meta+K" : "Control+K"}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low px-2.5 text-sm text-outline transition-colors hover:border-primary/40 hover:bg-surface-container-lowest hover:text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:w-60 sm:px-3 md:w-48 lg:w-60"
        >
          <Search size={16} className="shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">Jump to a tool...</span>
          <kbd className="ml-auto hidden items-center rounded-md border border-outline-variant bg-surface-container-lowest px-1.5 py-0.5 font-body-md text-[10px] font-semibold text-on-surface-variant sm:inline-flex">
            {modifier} K
          </kbd>
        </button>
        <UserMenu />
      </div>

      {isSwitcherOpen && <ToolSwitcher onClose={() => setIsSwitcherOpen(false)} />}
    </header>
  )
}
