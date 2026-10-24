"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { BookOpen, ChevronDown, Info } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { HelpArticle } from "@/components/help/HelpArticle"
import { HelpTopicList } from "@/components/help/HelpTopicList"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { useVisibleTools } from "@/hooks/useCurrentUser"
import { activeTopicId, flatTopics, helpTopicsFor, listScrollTop, sectionDomId } from "@/lib/helpTopics"
import { HELP_MESSAGES } from "@/constants/helpDocs"

/**
 * Help & Documentation: one article per module, with the topic list beside it.
 *
 * **The topics are the account's own tools** (`useVisibleTools`), in the sidebar's order, so this
 * page can never describe a tool the reader cannot open and never misses one that was added.
 *
 * The reading area is `main`, which is what scrolls here (the window does not), so the active topic
 * is worked out from each heading's position inside that element and the topic list is scrolled by
 * its own `scrollTop`. Both rules are pure functions in `lib/helpTopics.ts`.
 */

// How far below the top of the reading area a heading counts as the one being read
const ACTIVE_OFFSET = 96

/**
 * How far away a topic may be and still be glided to. A smooth scroll in a browser takes longer the
 * further it goes, and this page is 28 articles tall, so gliding from the first topic to the last
 * left the reader watching the page move for a second and a half. Anything beyond a couple of
 * screens is jumped to instead, which is what a topic list is for; a near one still glides, so the
 * reader can see which way the page moved.
 */
const GLIDE_WITHIN_SCREENS = 2

export default function HelpClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const tools = useVisibleTools()
  const sections = useMemo(() => helpTopicsFor(tools), [tools])
  const topics = useMemo(() => flatTopics(sections), [sections])
  const ids = useMemo(() => topics.map((topic) => topic.id), [topics])

  const [activeId, setActiveId] = useState("")
  const [isListOpen, setIsListOpen] = useState(false)
  const readingRef = useRef<HTMLElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  /** Puts the article at the top of the reading area, and the reader's focus on its heading. */
  const goTo = useCallback((topicId: string) => {
    const heading = document.getElementById(`${sectionDomId(topicId)}-heading`)
    const section = document.getElementById(sectionDomId(topicId))
    const reading = readingRef.current
    if (!section || !heading || !reading) return
    const away = Math.abs(section.getBoundingClientRect().top - reading.getBoundingClientRect().top)
    const glide =
      away < window.innerHeight * GLIDE_WITHIN_SCREENS && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    section.scrollIntoView({ behavior: glide ? "smooth" : "auto", block: "start" })
    heading.focus({ preventScroll: true })
    setActiveId(topicId)
    setIsListOpen(false)
  }, [])

  // Which article is being read, and keeping that topic in view in the list beside it
  useEffect(() => {
    const reading = readingRef.current
    if (!reading || ids.length === 0) return
    let frame = 0

    const read = () => {
      frame = 0
      const top = reading.getBoundingClientRect().top + ACTIVE_OFFSET
      const positions = ids.map((id) => {
        const node = document.getElementById(sectionDomId(id))
        return { id, top: node ? node.getBoundingClientRect().top - top : Number.POSITIVE_INFINITY }
      })
      const next = activeTopicId(positions)
      setActiveId(next)
      const list = listRef.current
      const link = list?.querySelector<HTMLElement>(`[data-topic="${next}"]`)
      if (list && link) {
        const wanted = listScrollTop(list.scrollTop, { top: link.offsetTop, height: link.offsetHeight }, { height: list.clientHeight })
        if (wanted !== list.scrollTop) list.scrollTop = wanted
      }
    }

    const onScroll = () => {
      // One read a frame at most, so a long page still scrolls smoothly
      if (!frame) frame = requestAnimationFrame(read)
    }

    // The first read is asked for rather than done here, so the state is never set while the
    // effect runs; it also covers a reload that restored a scroll position
    frame = requestAnimationFrame(() => {
      const wanted = window.location.hash.replace("#", "")
      const topicId = ids.find((id) => sectionDomId(id) === wanted)
      if (topicId) goTo(topicId)
      else read()
    })
    reading.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      reading.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [ids, goTo])

  const areaOf = (topicId: string) => sections.find((section) => section.topics.some((topic) => topic.id === topicId))?.label ?? ""
  const current = topics.find((topic) => topic.id === activeId)

  return (
    <div className="font-body-md text-body-md min-h-screen bg-background text-on-surface flex overflow-hidden h-screen">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        <Header onOpenSidebar={() => setIsSidebarOpen(true)} isSidebarCollapsed={isCollapsed} onToggleCollapse={toggleCollapsed} />

        <main ref={readingRef} className="flex-1 overflow-y-auto bg-background overflow-x-hidden">
          <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-5">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-2xl font-bold text-on-surface">
                <BookOpen size={24} className="text-primary shrink-0" aria-hidden="true" />
                {HELP_MESSAGES.title}
              </h1>
              <p className="mt-1 text-sm text-on-surface-variant">{HELP_MESSAGES.subtitle}</p>
            </div>

            {topics.length === 0 ? (
              <p className="rounded-2xl border border-outline-variant bg-white px-4 py-6 text-[13px] text-on-surface-variant">
                {HELP_MESSAGES.nothingToRead}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] lg:items-start">
                {/* The topics: a panel to open below lg, a list that stays beside the articles from lg */}
                <div className="lg:sticky lg:top-0">
                  <button
                    type="button"
                    onClick={() => setIsListOpen((open) => !open)}
                    aria-expanded={isListOpen}
                    className="flex w-full items-center justify-between gap-2 rounded-xl border border-outline-variant bg-white px-3 py-2.5 text-left text-[13px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high lg:hidden"
                  >
                    <span className="min-w-0 truncate">{current ? current.title : HELP_MESSAGES.allTopics}</span>
                    <ChevronDown size={16} className={`shrink-0 text-outline transition-transform ${isListOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                  <HelpTopicList
                    sections={sections}
                    activeId={activeId}
                    onPick={goTo}
                    listRef={listRef}
                    className={`${isListOpen ? "mt-2 max-h-[60vh]" : "hidden"} rounded-2xl border border-outline-variant bg-white p-2 lg:mt-0 lg:block lg:max-h-[calc(100dvh-10rem)]`}
                  />
                </div>

                <div className="flex min-w-0 flex-col gap-4">
                  <p className="flex items-start gap-2 rounded-xl border border-outline-variant/60 bg-surface-container-low px-3 py-2 text-[12px] leading-relaxed text-on-surface-variant">
                    <Info size={14} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                    <span>{HELP_MESSAGES.onlyYourTools}</span>
                  </p>
                  {topics.map((topic) => (
                    <HelpArticle key={topic.id} topic={topic} area={areaOf(topic.id)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
