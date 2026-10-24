"use client"

import React from "react"
import { sectionDomId } from "@/lib/helpTopics"
import { HELP_MESSAGES } from "@/constants/helpDocs"
import type { HelpSection } from "@/types/help"

/**
 * The topic list beside the articles: every module under its own area's heading, with the one being
 * read marked by a filled row and a bar down its left edge, so the reader's place is obvious without
 * relying on colour alone.
 *
 * Each topic is a real link to the article's own id, so it works with the keyboard, can be opened in
 * a new tab and can be sent to somebody; the click is taken over only to scroll smoothly and to move
 * focus to the heading. `data-topic` is how the page finds the active link to keep it in view.
 */

interface HelpTopicListProps {
  sections: readonly HelpSection[]
  activeId: string
  onPick: (topicId: string) => void
  // The scrolling element, so the page can keep the topic being read inside it
  listRef?: React.Ref<HTMLDivElement>
  className?: string
}

export const HelpTopicList: React.FC<HelpTopicListProps> = ({ sections, activeId, onPick, listRef, className = "" }) => (
  <div ref={listRef} className={`overflow-y-auto overscroll-contain ${className}`}>
    <nav aria-label={HELP_MESSAGES.topicsHeading} className="flex flex-col gap-5">
      {sections.map((section) => (
        <div key={section.id}>
          <div className="flex items-baseline justify-between gap-2 px-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-outline">{section.label}</p>
            <span className="text-[11px] font-semibold text-outline/70">{section.topics.length}</span>
          </div>
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {section.topics.map((topic) => {
              const isActive = topic.id === activeId
              return (
                <li key={topic.id}>
                  <a
                    href={`#${sectionDomId(topic.id)}`}
                    data-topic={topic.id}
                    aria-current={isActive ? "true" : undefined}
                    title={topic.summary}
                    onClick={(event) => {
                      // Left click only, so Ctrl, Cmd and the middle button still open a new tab
                      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                      event.preventDefault()
                      onPick(topic.id)
                    }}
                    className={`flex items-center gap-2 border-l-2 py-1.5 pl-2.5 pr-2 text-[13.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                      isActive
                        ? "border-primary bg-primary-fixed font-semibold text-on-primary-fixed-variant"
                        : "border-transparent text-on-surface-variant hover:border-outline-variant hover:bg-surface-container-high hover:text-on-surface"
                    }`}
                  >
                    <span className="min-w-0 truncate">{topic.title}</span>
                    {topic.badge && (
                      <span className="ml-auto shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                        {topic.badge}
                      </span>
                    )}
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  </div>
)
