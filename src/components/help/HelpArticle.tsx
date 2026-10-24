"use client"

import React from "react"
import Link from "next/link"
import { ArrowUpRight, Info, ListOrdered, Lightbulb } from "lucide-react"
import { sectionDomId } from "@/lib/helpTopics"
import { HELP_MESSAGES } from "@/constants/helpDocs"
import type { HelpTopic } from "@/types/help"

/**
 * One module's article: what it does, how to use it, and what is worth knowing. The text is plain
 * (`constants/helpDocs.ts`), so this decides the typography and nothing has to be parsed.
 *
 * The heading carries the id the topic list links to and can take focus, so choosing a topic by
 * keyboard lands the reader on the article rather than leaving focus behind in the list.
 */

interface HelpArticleProps {
  topic: HelpTopic
  // Named so a screen reader reads which area of the app this article belongs to
  area: string
}

export const HelpArticle: React.FC<HelpArticleProps> = ({ topic, area }) => {
  const { doc } = topic
  return (
    <section
      id={sectionDomId(topic.id)}
      aria-labelledby={`${sectionDomId(topic.id)}-heading`}
      className="scroll-mt-4 rounded-2xl border border-outline-variant bg-white p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-outline">{area}</p>
          <h2
            id={`${sectionDomId(topic.id)}-heading`}
            tabIndex={-1}
            className="mt-1 text-lg font-bold text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {topic.title}
          </h2>
        </div>
        {topic.href && (
          <Link
            href={topic.href}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-outline-variant bg-white px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
          >
            {HELP_MESSAGES.openTool}
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        )}
      </div>

      {doc.todo ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-secondary-fixed px-3 py-2 text-[13px] text-on-surface">
          <Info size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{HELP_MESSAGES.todo}</span>
        </p>
      ) : (
        <p className="mt-3 text-[14px] leading-relaxed text-on-surface">{doc.summary}</p>
      )}

      {doc.steps.length > 0 && (
        <div className="mt-4">
          <h3 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-outline">
            <ListOrdered size={14} className="text-primary" aria-hidden="true" />
            {HELP_MESSAGES.stepsHeading}
          </h3>
          <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-[13px] leading-relaxed text-on-surface-variant">
            {doc.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {doc.notes && doc.notes.length > 0 && (
        <div className="mt-4">
          <h3 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-outline">
            <Lightbulb size={14} className="text-primary" aria-hidden="true" />
            {HELP_MESSAGES.notesHeading}
          </h3>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[13px] leading-relaxed text-on-surface-variant">
            {doc.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
