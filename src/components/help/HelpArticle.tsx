"use client"

import React from "react"
import Link from "next/link"
import { ArrowUpRight, Info, Lightbulb, ShieldCheck } from "lucide-react"
import { sectionDomId } from "@/lib/helpTopics"
import { HELP_MESSAGES } from "@/constants/helpDocs"
import type { HelpTopic } from "@/types/help"

/**
 * One module's article: what it does, the steps to use it, and what is worth knowing. The text is
 * plain (`constants/helpDocs.ts`), so this decides the whole of the typography and nothing has to
 * be parsed: a lead line to read first, numbered steps in violet, and the notes in the brand's gold
 * so the two lists are told apart at a glance rather than by their headings alone.
 *
 * The heading carries the id the topic list links to and can take focus, so choosing a topic by
 * keyboard lands the reader on the article rather than leaving focus behind in the list.
 */

interface HelpArticleProps {
  topic: HelpTopic
}

export const HelpArticle: React.FC<HelpArticleProps> = ({ topic }) => {
  const { doc } = topic
  return (
    <article
      id={sectionDomId(topic.id)}
      aria-labelledby={`${sectionDomId(topic.id)}-heading`}
      className="scroll-mt-28 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id={`${sectionDomId(topic.id)}-heading`}
              tabIndex={-1}
              className="text-[20px] font-bold tracking-tight text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:text-[22px]"
            >
              {topic.title}
            </h2>
            {topic.badge && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-white">
                <ShieldCheck size={11} aria-hidden="true" />
                {topic.badge}
              </span>
            )}
          </div>
          {doc.todo ? (
            <p className="mt-2 flex items-start gap-2 text-[14px] text-on-surface-variant">
              <Info size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{HELP_MESSAGES.todo}</span>
            </p>
          ) : (
            <p className="mt-2 max-w-[70ch] text-[15px] leading-relaxed text-on-surface">{doc.summary}</p>
          )}
        </div>
        {topic.href && (
          <Link
            href={topic.href}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-[12px] font-semibold text-on-surface transition-colors hover:border-primary/40 hover:bg-primary-fixed hover:text-on-primary-fixed-variant"
          >
            {HELP_MESSAGES.openTool}
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        )}
      </div>

      {doc.steps.length > 0 && (
        <div className="mt-5">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-outline">{HELP_MESSAGES.stepsHeading}</h3>
          <ol className="mt-2.5 flex flex-col gap-2.5">
            {doc.steps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary-fixed text-[11px] font-bold text-on-primary-fixed-variant"
                >
                  {index + 1}
                </span>
                <span className="max-w-[78ch] text-[14px] leading-relaxed text-on-surface-variant">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {doc.notes && doc.notes.length > 0 && (
        <div className="mt-5 rounded-xl border border-secondary-fixed bg-secondary-fixed/40 p-4">
          <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">
            <Lightbulb size={13} aria-hidden="true" />
            {HELP_MESSAGES.notesHeading}
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {doc.notes.map((note) => (
              <li key={note} className="flex gap-2.5">
                <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-on-surface-variant/60" />
                <span className="max-w-[78ch] text-[13.5px] leading-relaxed text-on-surface">{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}
