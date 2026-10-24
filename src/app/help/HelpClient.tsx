"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowUp, ChevronDown, ExternalLink, Search, X } from "lucide-react"
import { BrandLogo } from "@/components/ui/BrandLogo"
import { HelpArticle } from "@/components/help/HelpArticle"
import { HelpTopicList } from "@/components/help/HelpTopicList"
import { activeTopicId, flatTopics, helpSections, listScrollTop, narrowSections, sectionDomId } from "@/lib/helpTopics"
import { HELP_MESSAGES } from "@/constants/helpDocs"
import { HOME_PATH } from "@/constants/auth"
import { SITE_NAME } from "@/config/site"

/**
 * Help & Documentation: a page of its own, read **without signing in**.
 *
 * It deliberately does **not** wear the app's shell (no sidebar, no account menu): it is
 * documentation about the app rather than a tool inside it, so it is full width, has its own header
 * and works for somebody who has never signed in. `src/proxy.ts` lets this one path through signed
 * in or out, and nothing on it reads an account, so there is no request to make and nothing to wait
 * for; the whole page is prerendered.
 *
 * The window is what scrolls here, so the topic being read is worked out from each heading's
 * position against the line under the sticky header, and the topic list is scrolled by its own
 * `scrollTop`. Both rules are pure functions in `lib/helpTopics.ts`.
 */

// The line a heading has to pass to count as the one being read: the sticky header and some air
const ACTIVE_OFFSET = 140
// How far down the page the way back to the top is worth offering
const BACK_TO_TOP_AFTER = 900
/**
 * How far away a topic may be and still be glided to. A browser's smooth scroll takes longer the
 * further it goes, and this page is 28 articles tall, so gliding from the first topic to the last
 * left the reader watching the page move for over a second.
 */
const GLIDE_WITHIN_SCREENS = 2

export default function HelpClient() {
  const sections = useMemo(() => helpSections(), [])
  const [query, setQuery] = useState("")
  const shown = useMemo(() => narrowSections(sections, query), [sections, query])
  const topics = useMemo(() => flatTopics(shown), [shown])
  const ids = useMemo(() => topics.map((topic) => topic.id), [topics])

  const [activeId, setActiveId] = useState("")
  const [isListOpen, setIsListOpen] = useState(false)
  const [isDeepIn, setIsDeepIn] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const moduleCount = useMemo(() => flatTopics(sections).filter((topic) => topic.href).length, [sections])
  const isSearching = query.trim().length > 0

  /** Puts the article under the page's header, and the reader's focus on its heading. */
  const goTo = useCallback((topicId: string) => {
    const heading = document.getElementById(`${sectionDomId(topicId)}-heading`)
    const article = document.getElementById(sectionDomId(topicId))
    if (!article || !heading) return
    const away = Math.abs(article.getBoundingClientRect().top)
    const glide = away < window.innerHeight * GLIDE_WITHIN_SCREENS && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    article.scrollIntoView({ behavior: glide ? "smooth" : "auto", block: "start" })
    heading.focus({ preventScroll: true })
    setActiveId(topicId)
    setIsListOpen(false)
  }, [])

  // Which article is being read, and keeping that topic in view in the list beside it
  useEffect(() => {
    if (ids.length === 0) return
    let frame = 0

    const read = () => {
      frame = 0
      const positions = ids.map((id) => {
        const node = document.getElementById(sectionDomId(id))
        return { id, top: node ? node.getBoundingClientRect().top - ACTIVE_OFFSET : Number.POSITIVE_INFINITY }
      })
      const next = activeTopicId(positions)
      setActiveId(next)
      setIsDeepIn(window.scrollY > BACK_TO_TOP_AFTER)
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

    // The first read is asked for rather than done here, so the state is never set while the effect
    // runs; that same frame honours a #help-<module> in the address, so one topic can be linked to
    frame = requestAnimationFrame(() => {
      const wanted = window.location.hash.replace("#", "")
      const topicId = ids.find((id) => sectionDomId(id) === wanted)
      if (topicId) goTo(topicId)
      else read()
    })
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [ids, goTo])

  const current = topics.find((topic) => topic.id === activeId)

  const searchBox = (id: string, className: string) => (
    <div className={`relative ${className}`}>
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-outline" aria-hidden="true" />
      <input
        id={id}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={HELP_MESSAGES.search}
        aria-label={HELP_MESSAGES.search}
        className="w-full rounded-xl border border-outline-variant bg-white py-2.5 pl-9 pr-9 text-[14px] text-on-surface placeholder:text-outline focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      {isSearching && (
        <button
          type="button"
          onClick={() => setQuery("")}
          aria-label={HELP_MESSAGES.clearSearch}
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg text-outline transition-colors hover:bg-surface-container-high hover:text-on-surface"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  )

  return (
    <div className="font-body-md text-body-md min-h-dvh bg-background text-on-surface">
      {/* The page's own header: no sidebar and no account menu, because nobody has to be signed in */}
      <header className="sticky top-0 z-40 border-b border-outline-variant bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
          <BrandLogo priority />
          <span className="hidden text-[13px] font-semibold text-on-surface-variant sm:inline" aria-hidden="true">
            /
          </span>
          <span className="hidden text-[13px] font-semibold text-on-surface-variant sm:inline">{HELP_MESSAGES.title}</span>
          <div className="ml-auto flex items-center gap-2">
            {searchBox("help-search-top", "hidden w-72 md:block")}
            <Link
              href={HOME_PATH}
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-primary px-3.5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant"
            >
              {HELP_MESSAGES.openApp}
              <ExternalLink size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      {/* What this page is, and the areas it covers */}
      <section className="border-b border-outline-variant bg-white">
        <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-primary">{SITE_NAME}</p>
          <h1 className="mt-2 text-[30px] font-bold leading-tight tracking-tight text-on-surface sm:text-[38px]">{HELP_MESSAGES.title}</h1>
          <p className="mt-3 max-w-[70ch] text-[15px] leading-relaxed text-on-surface-variant sm:text-[16px]">{HELP_MESSAGES.lede}</p>
          {searchBox("help-search-hero", "mt-5 max-w-md md:hidden")}
          <ul className="mt-6 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-5">
            {sections.map((section) => (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => goTo(section.topics[0].id)}
                  className="flex h-full w-full flex-col gap-0.5 rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary-fixed"
                >
                  <span className="truncate text-[13px] font-bold text-on-surface">{section.label}</span>
                  <span className="text-[11.5px] text-on-surface-variant">
                    {section.id === "start" ? HELP_MESSAGES.matches(section.topics.length) : HELP_MESSAGES.countOf(section.topics.length)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-5 max-w-[80ch] text-[12.5px] leading-relaxed text-outline">{HELP_MESSAGES.isPublic}</p>
        </div>
      </section>

      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[270px_minmax(0,1fr)] lg:gap-10">
          {/* The topics: a panel to open below lg, a list beside the articles from lg */}
          <aside className="lg:sticky lg:top-[72px] lg:self-start">
            <button
              type="button"
              onClick={() => setIsListOpen((open) => !open)}
              aria-expanded={isListOpen}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-outline-variant bg-white px-3.5 py-3 text-left text-[13.5px] font-semibold text-on-surface shadow-sm transition-colors hover:bg-surface-container-high lg:hidden"
            >
              <span className="min-w-0 truncate">{current ? current.title : HELP_MESSAGES.allTopics}</span>
              <ChevronDown size={16} className={`shrink-0 text-outline transition-transform ${isListOpen ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            <HelpTopicList
              sections={shown}
              activeId={activeId}
              onPick={goTo}
              listRef={listRef}
              className={`${isListOpen ? "mt-2 max-h-[65vh]" : "hidden"} rounded-2xl border border-outline-variant bg-white p-3 shadow-sm lg:mt-0 lg:block lg:max-h-[calc(100dvh-7rem)]`}
            />
          </aside>

          <main className="flex min-w-0 flex-col gap-10">
            {isSearching && (
              <p className="text-[13px] text-on-surface-variant" role="status">
                {topics.length > 0 ? HELP_MESSAGES.matches(topics.length) : HELP_MESSAGES.noMatch}
              </p>
            )}
            {shown.map((section) => (
              <section key={section.id} aria-labelledby={`help-area-${section.id}`} className="flex flex-col gap-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-outline-variant pb-2">
                  <h2 id={`help-area-${section.id}`} className="text-[15px] font-bold uppercase tracking-[0.08em] text-on-surface">
                    {section.label}
                  </h2>
                  {section.hint && <p className="text-[13px] text-on-surface-variant">{section.hint}</p>}
                </div>
                {section.topics.map((topic) => (
                  <HelpArticle key={topic.id} topic={topic} />
                ))}
              </section>
            ))}
            {shown.length === 0 && !isSearching && (
              <p className="rounded-2xl border border-outline-variant bg-white px-4 py-6 text-[13px] text-on-surface-variant">
                {HELP_MESSAGES.nothingToRead}
              </p>
            )}
          </main>
        </div>
      </div>

      <footer className="border-t border-outline-variant bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-6 sm:px-6 lg:px-8">
          <p className="max-w-[60ch] text-[12.5px] text-on-surface-variant">{HELP_MESSAGES.footer}</p>
          <p className="text-[12.5px] font-semibold text-outline">
            {SITE_NAME} · {HELP_MESSAGES.countOf(moduleCount)}
          </p>
        </div>
      </footer>

      {isDeepIn && (
        <button
          type="button"
          onClick={() => {
            // The same rule the topics follow: a glide from deep in the page is a long animation
            const glide =
              window.scrollY < window.innerHeight * GLIDE_WITHIN_SCREENS && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
            window.scrollTo({ top: 0, behavior: glide ? "smooth" : "auto" })
            setActiveId(ids[0] ?? "")
          }}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-white px-3.5 py-2.5 text-[12.5px] font-semibold text-on-surface shadow-lg transition-colors hover:bg-surface-container-high"
        >
          <ArrowUp size={14} aria-hidden="true" />
          {HELP_MESSAGES.backToTop}
        </button>
      )}
    </div>
  )
}
