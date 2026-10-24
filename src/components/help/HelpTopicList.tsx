"use client"

import React from "react"
import { sectionDomId } from "@/lib/helpTopics"
import { HELP_MESSAGES } from "@/constants/helpDocs"
import type { HelpSection } from "@/types/help"

/**
 * The topic list beside the articles: every module the account can open, under its own area's
 * heading, with the one being read marked.
 *
 * Each topic is a real link to the article's own id, so it works with the keyboard, can be opened
 * in a new tab and can be sent to somebody; the click is taken over only to scroll smoothly and to
 * move focus to the heading. `data-topic` is how the page finds the active link to keep it in view.
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
  <div ref={listRef} className={`overflow-y-auto ${className}`}>
    <nav aria-label={HELP_MESSAGES.topicsHeading} className="flex flex-col gap-4">
      {sections.map((section) => (
        <div key={section.id}>
          <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-outline">{section.label}</p>
          <ul className="mt-1 flex flex-col">
            {section.topics.map((topic) => {
              const isActive = topic.id === activeId
              return (
                <li key={topic.id}>
                  <a
                    href={`#${sectionDomId(topic.id)}`}
                    data-topic={topic.id}
                    aria-current={isActive ? "true" : undefined}
                    onClick={(event) => {
                      // Left click only, so Ctrl, Cmd and the middle button still open a new tab
                      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                      event.preventDefault()
                      onPick(topic.id)
                    }}
                    className={`block rounded-lg px-2 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                      isActive
                        ? "bg-primary-fixed font-semibold text-on-primary-fixed-variant"
                        : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                    }`}
                  >
                    {topic.title}
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
