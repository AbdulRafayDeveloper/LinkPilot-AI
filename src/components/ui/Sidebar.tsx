"use client"

import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ChevronDown, Loader2, Search, X } from "lucide-react"
import { BrandLogo } from "./BrandLogo"
import { TOOL_GROUPS, type LinkedInTool, type ToolLink } from "@/constants/linkedinTools"
import { GLOBAL_PROMPTS_LINK } from "@/constants/globalPrompts"
import { markToolSeen, useToolActivity, type ActivityState } from "@/lib/toolActivity"
import { useSidebarDropdowns } from "@/hooks/useSidebarDropdowns"
import { useVisibleTools } from "@/hooks/useCurrentUser"

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

// The collapsed rail's tooltip for one row, on hover and on keyboard focus alike
const railHintHandlers = (isCollapsed: boolean, title: string, detail: string, onHint: (hint: RailHint | null) => void) => {
  const show = (event: React.SyntheticEvent<HTMLElement>) => {
    if (!isCollapsed || !isDesktop()) return
    const rect = event.currentTarget.getBoundingClientRect()
    onHint({ title, detail, top: rect.top + rect.height / 2 })
  }
  return { onMouseEnter: show, onFocus: show, onMouseLeave: () => onHint(null), onBlur: () => onHint(null) }
}

// Rows are kept tight so every tool, an open dropdown included, fits a 900px screen without scrolling
const rowClass = (isCollapsed: boolean, isActive: boolean, compact = false) =>
  `group flex w-full items-center gap-2.5 rounded-lg px-2 ${compact ? "py-px" : "py-[2px]"} text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${whenCollapsed(
    isCollapsed,
    "lg:justify-center lg:px-0"
  )} ${isActive ? "bg-primary-fixed/45" : "hover:bg-surface-container-low"}`

const tileClass = (isActive: boolean, compact = false) =>
  `relative flex ${compact ? "h-5 w-5 rounded-md" : "h-6 w-6 rounded-md"} shrink-0 items-center justify-center transition-colors duration-150 ${
    isActive
      ? "bg-primary text-on-primary shadow-sm"
      : "bg-surface-container-low text-on-surface-variant group-hover:bg-surface-container-lowest group-hover:text-primary group-hover:shadow-sm"
  }`

const titleClass = (isCollapsed: boolean, isActive: boolean) =>
  `min-w-0 flex-1 truncate text-[13px] leading-5 ${
    isActive ? "font-semibold text-on-surface" : "font-medium text-on-surface-variant group-hover:text-on-surface"
  } ${whenCollapsed(isCollapsed, "lg:sr-only")}`

// Every page draws its own sidebar, so how far the list was scrolled is kept for this browser tab
// and put back on the next page, instead of the list jumping to the top on every click
const SCROLL_KEY = "linkpilot:sidebarScroll"

const readSavedScroll = () => {
  try {
    return Number(window.sessionStorage.getItem(SCROLL_KEY)) || 0
  } catch {
    return 0
  }
}

// Every word typed must appear in the name, in any order, ignoring case: "note conn" finds Connection Note
const matchesSearch = (name: string, query: string) => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const haystack = name.toLowerCase()
  return words.every((word) => haystack.includes(word))
}

const ActiveBar = () => <span className="absolute -left-3 top-0.5 bottom-0.5 w-[3px] rounded-r-full bg-primary" aria-hidden="true" />

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
  // A page inside a dropdown, one size smaller than the tools around it
  compact?: boolean
}

// One navigation row: an icon tile and the name, on a single line, so a long list of tools stays
// scannable. The description is the row's tooltip, and the rail tooltip when collapsed.
const SidebarLink: React.FC<SidebarLinkProps> = ({ link, isActive, isCollapsed, activity, onNavigate, onHint, compact = false }) => {
  const { title, description, icon: Icon, href } = link

  return (
    <li className="relative">
      {isActive && <ActiveBar />}
      <Link
        href={href}
        title={description}
        onClick={onNavigate}
        {...railHintHandlers(isCollapsed, title, activity ? ACTIVITY_TEXT[activity] : description, onHint)}
        aria-current={isActive ? "page" : undefined}
        className={rowClass(isCollapsed, isActive, compact)}
      >
        <span className={tileClass(isActive, compact)}>
          <Icon size={compact ? 12 : 14} aria-hidden="true" />
          {activity && isCollapsed && <ActivityMark state={activity} className="absolute -right-1 -top-1 hidden lg:block" />}
        </span>
        <span className={titleClass(isCollapsed, isActive)}>{title}</span>
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

interface SidebarDropdownProps {
  tool: LinkedInTool
  links: ToolLink[]
  pathname: string
  isCollapsed: boolean
  isOpen: boolean
  onToggle: () => void
  activityOf: (href: string) => ActivityState | undefined
  onNavigate: () => void
  onHint: (hint: RailHint | null) => void
}

/**
 * A tool with more than one page. Its row opens and closes the list of those pages instead of
 * going anywhere, and the pages sit indented beneath it. Only a click on that row changes it:
 * choosing one of its pages, going to another tool or reloading leaves it exactly as it was.
 */
const SidebarDropdown: React.FC<SidebarDropdownProps> = ({
  tool,
  links,
  pathname,
  isCollapsed,
  isOpen,
  onToggle,
  activityOf,
  onNavigate,
  onHint,
}) => {
  const listId = useId()
  const { title, description, icon: Icon } = tool
  const containsActive = links.some((link) => link.href === pathname)
  // Closed, the row itself carries what its hidden pages would have shown
  const showsAsActive = containsActive && !isOpen
  const hiddenActivity = isOpen
    ? undefined
    : links.map((link) => (link.href === pathname ? undefined : activityOf(link.href))).find((state) => state !== undefined)

  return (
    <li className="relative">
      {showsAsActive && <ActiveBar />}
      <button
        type="button"
        onClick={onToggle}
        title={description}
        aria-expanded={isOpen}
        aria-controls={listId}
        {...railHintHandlers(isCollapsed, title, isOpen ? `Hide ${title} pages` : `Show ${title} pages`, onHint)}
        className={rowClass(isCollapsed, showsAsActive)}
      >
        <span className={tileClass(showsAsActive)}>
          <Icon size={14} aria-hidden="true" />
          {hiddenActivity && isCollapsed && <ActivityMark state={hiddenActivity} className="absolute -right-1 -top-1 hidden lg:block" />}
        </span>
        <span className={titleClass(isCollapsed, containsActive)}>{title}</span>
        {hiddenActivity && (
          <span className={`flex shrink-0 items-center ${whenCollapsed(isCollapsed, "lg:hidden")}`}>
            <ActivityMark state={hiddenActivity} />
          </span>
        )}
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`shrink-0 text-outline transition-transform duration-150 ${isOpen ? "rotate-180" : ""} ${whenCollapsed(isCollapsed, "lg:hidden")}`}
        />
      </button>

      {/* Indented under the row with a hairline tying the pages to it; the rail keeps its icons centred */}
      <ul
        id={listId}
        hidden={!isOpen}
        aria-label={`${title} pages`}
        className={`ml-[18px] border-l border-outline-variant/80 pl-2 ${whenCollapsed(isCollapsed, "lg:ml-0 lg:border-l-0 lg:pl-0")}`}
      >
        {links.map((link) => (
          <SidebarLink
            key={link.href}
            link={link}
            isActive={pathname === link.href}
            isCollapsed={isCollapsed}
            activity={pathname === link.href ? undefined : activityOf(link.href)}
            onNavigate={onNavigate}
            onHint={onHint}
            compact
          />
        ))}
      </ul>
    </li>
  )
}

/**
 * App navigation: the brand, every tool under the four headings in TOOL_GROUPS, and Global AI
 * Prompts pinned at the bottom. A drawer on small screens; on desktop a full column that
 * collapses to an icon rail. Every tool shows when it's writing in the background or has a
 * result waiting. A tool with several pages is a dropdown that stays as the user left it.
 */
export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, isCollapsed = false }) => {
  const pathname = usePathname()
  const activity = useToolActivity()
  const dropdowns = useSidebarDropdowns()
  // The admin area appears only once the account is known to be an admin, never flashing for a user
  const tools = useVisibleTools()
  const [hint, setHint] = useState<RailHint | null>(null)
  const [query, setQuery] = useState("")
  const router = useRouter()
  const searchId = useId()
  const activityOf = (href: string) => activity.find((entry) => entry.href === href)?.state
  const isSearching = query.trim().length > 0
  const navRef = useRef<HTMLElement>(null)
  const saveFrame = useRef<number | null>(null)

  // Back to where the list was on the previous page, before it is painted, and once more on the
  // next frame in case the remembered dropdowns opened after the first paint and made it taller
  useLayoutEffect(() => {
    const saved = readSavedScroll()
    if (!saved || !navRef.current) return
    navRef.current.scrollTop = saved
    const frame = window.requestAnimationFrame(() => {
      if (navRef.current && navRef.current.scrollTop !== saved) navRef.current.scrollTop = saved
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(
    () => () => {
      if (saveFrame.current !== null) window.cancelAnimationFrame(saveFrame.current)
    },
    []
  )

  const handleNavScroll = () => {
    setHint(null)
    // A search makes the list shorter for a moment; that position isn't the one to come back to
    if (isSearching || saveFrame.current !== null) return
    saveFrame.current = window.requestAnimationFrame(() => {
      saveFrame.current = null
      try {
        window.sessionStorage.setItem(SCROLL_KEY, String(Math.round(navRef.current?.scrollTop ?? 0)))
      } catch {
        // The position simply isn't remembered
      }
    })
  }

  // What a search leaves: a tool whose name matches keeps all its pages; otherwise a dropdown
  // stays only for the pages whose own names match, and shows just those
  const visibleTools = tools.flatMap((tool) => {
    if (!isSearching || matchesSearch(tool.title, query)) return [tool]
    const links = tool.links?.filter((link) => matchesSearch(link.title, query))
    return links && links.length > 0 ? [{ ...tool, links }] : []
  })
  const showGlobalPrompts = !isSearching || matchesSearch(GLOBAL_PROMPTS_LINK.title, query)
  const firstMatch = visibleTools[0]?.links?.[0]?.href ?? visibleTools[0]?.href ?? (showGlobalPrompts ? GLOBAL_PROMPTS_LINK.href : undefined)
  const matchCount = visibleTools.length + (isSearching && showGlobalPrompts ? 1 : 0)

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

  const renderTool = (tool: LinkedInTool) => {
    if (!tool.links) return renderLink(tool)
    const open = dropdowns.isOpen(tool.id, tool.links.some((link) => link.href === pathname))
    return (
      <SidebarDropdown
        key={tool.id}
        tool={tool}
        links={tool.links}
        pathname={pathname}
        isCollapsed={isCollapsed}
        // While searching, every dropdown that matched is open so its pages can be seen; the saved choice is untouched
        isOpen={isSearching || open}
        onToggle={() => dropdowns.setOpen(tool.id, !open)}
        activityOf={activityOf}
        onNavigate={onClose}
        onHint={setHint}
      />
    )
  }

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

        {/* Search: outside the scrolling list, so it stays put however far the tools are scrolled.
            The icon rail has no room for it; Ctrl/⌘+K opens the tool switcher there */}
        <div role="search" className={`shrink-0 px-3 pb-1 pt-2 ${whenCollapsed(isCollapsed, "lg:hidden")}`}>
          <label htmlFor={searchId} className="sr-only">
            Search tools
          </label>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-outline" aria-hidden="true" />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && query) {
                  event.preventDefault()
                  setQuery("")
                } else if (event.key === "Enter" && isSearching && firstMatch) {
                  event.preventDefault()
                  setQuery("")
                  onClose()
                  router.push(firstMatch)
                }
              }}
              placeholder="Search tools"
              autoComplete="off"
              spellCheck={false}
              aria-controls="sidebar-tools"
              className="h-8 w-full rounded-lg border border-outline-variant bg-surface-container-low pl-8 pr-7 text-[13px] text-on-surface placeholder:text-outline transition-colors focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/25 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-outline hover:bg-surface-container-high hover:text-on-surface"
              >
                <X size={13} aria-hidden="true" />
              </button>
            )}
          </div>
          <span className="sr-only" aria-live="polite">
            {isSearching ? `${matchCount} ${matchCount === 1 ? "tool" : "tools"} found` : ""}
          </span>
        </div>

        <nav
          ref={navRef}
          id="sidebar-tools"
          aria-label="Main"
          onScroll={handleNavScroll}
          className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-1.5"
        >
          {isSearching && matchCount === 0 && (
            <p className={`px-2 py-3 text-[12px] text-outline ${whenCollapsed(isCollapsed, "lg:hidden")}`}>No tool matches &ldquo;{query.trim()}&rdquo;.</p>
          )}
          {TOOL_GROUPS.filter((group) => visibleTools.some((tool) => tool.group === group.id)).map((group, index) => (
            <section key={group.id} aria-labelledby={`nav-group-${group.id}`} className={index > 0 ? "mt-1" : ""}>
              {/* Collapsed, a thin line separates the groups instead of their names */}
              {index > 0 && <div className={`mx-2 mb-3 hidden h-px bg-outline-variant/70 ${whenCollapsed(isCollapsed, "lg:block")}`} aria-hidden="true" />}
              <h2
                id={`nav-group-${group.id}`}
                className={`mb-1 px-2 text-[10px] font-semibold uppercase leading-4 tracking-[0.11em] text-outline ${whenCollapsed(isCollapsed, "lg:sr-only")}`}
              >
                {group.label}
              </h2>
              <ul>{visibleTools.filter((tool) => tool.group === group.id).map(renderTool)}</ul>
            </section>
          ))}
        </nav>

        {/* Global AI Prompts: shared settings for every tool, not a LinkedIn tool */}
        {showGlobalPrompts && (
          <div className="shrink-0 border-t border-outline-variant/80 px-3 py-2">
            <ul>{renderLink(GLOBAL_PROMPTS_LINK)}</ul>
          </div>
        )}
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
