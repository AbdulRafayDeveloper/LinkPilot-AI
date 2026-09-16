"use client"

import React from "react"
import { ChevronDown, Clock, ExternalLink, Camera, ShieldCheck } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import { LINKEDIN_CONTENT_SEARCH_URL } from "@/constants/trending"
import type { TrendingReference, TrendingTopic } from "@/services/trending/schema"
import { TopicPost } from "./TopicPost"

const SectionLabel: React.FC<{ children: React.ReactNode; action?: React.ReactNode }> = ({ children, action }) => (
  <div className="flex items-center justify-between gap-2 mb-1.5 min-h-[22px]">
    <h4 className="text-[10px] font-bold text-outline uppercase tracking-wider">{children}</h4>
    {action}
  </div>
)

const ReferenceLink: React.FC<{ reference: TrendingReference }> = ({ reference }) => (
  <div className="flex items-center gap-1 min-w-0">
    <a
      href={reference.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group/link flex-1 min-w-0 flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-container-low transition-colors"
    >
      <ExternalLink size={14} className="shrink-0 text-primary" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-on-surface group-hover/link:text-primary">
          {reference.title}
        </span>
        <span className="block truncate text-[11px] text-outline">{reference.source}</span>
      </span>
      <span className="sr-only">(opens in a new tab)</span>
    </a>
    <CopyButton text={reference.url} label={`Copy link: ${reference.title}`} />
  </div>
)

function formatEventDate(eventDate: string | null): string | null {
  if (!eventDate) return null
  return new Date(`${eventDate}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

function linkedInSearchUrl(query: string): string {
  return `${LINKEDIN_CONTENT_SEARCH_URL}?keywords=${encodeURIComponent(query)}`
}

export const TopicCard: React.FC<{ topic: TrendingTopic }> = ({ topic }) => {
  const isToday = topic.freshness === "Today"
  const eventDate = formatEventDate(topic.event_date)

  return (
    <article className="bg-white border border-outline-variant rounded-2xl shadow-sm p-5 flex flex-col gap-4 min-w-0">
      {/* Freshness & category */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
            isToday ? "bg-secondary-fixed text-on-secondary-fixed-variant" : "bg-primary-fixed text-on-primary-fixed-variant"
          }`}
        >
          <Clock size={11} aria-hidden="true" />
          {isToday ? "New today" : topic.freshness}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">
          {topic.category}
        </span>
      </div>

      {/* Title */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-bold text-on-surface leading-snug">{topic.title}</h3>
        <CopyButton text={topic.title} label="Copy topic" />
      </div>

      <section>
        <SectionLabel>Why it&apos;s trending</SectionLabel>
        <p className="text-[13px] text-on-surface-variant leading-relaxed">{topic.why_trending}</p>
      </section>

      {topic.linkedin_angle && (
        <section>
          <SectionLabel>The angle on LinkedIn</SectionLabel>
          <p className="text-[13px] text-on-surface-variant leading-relaxed">{topic.linkedin_angle}</p>
        </section>
      )}

      <section>
        <SectionLabel
          action={
            <CopyButton text={topic.linkedin_search_queries.join("\n")} label="Copy all LinkedIn searches" showLabel />
          }
        >
          LinkedIn search
        </SectionLabel>
        <ul className="space-y-1">
          {topic.linkedin_search_queries.map((query) => (
            <li key={query} className="flex items-center gap-0.5 bg-surface-container-low rounded-lg pl-3 pr-1 py-0.5">
              <span className="flex-1 min-w-0 truncate text-[13px] text-on-surface" title={query}>
                {query}
              </span>
              <a
                href={linkedInSearchUrl(query)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Search LinkedIn for ${query} (opens in a new tab)`}
                title="Search on LinkedIn"
                className="p-1 rounded-md text-outline hover:text-primary hover:bg-surface-container transition-colors"
              >
                <ExternalLink size={14} aria-hidden="true" />
              </a>
              <CopyButton text={query} label={`Copy search: ${query}`} />
            </li>
          ))}
        </ul>
      </section>

      <TopicPost topic={topic} />

      {/* Secondary research details */}
      <details className="group border-t border-outline-variant/60 pt-3 mt-auto">
        <summary className="flex items-center justify-between cursor-pointer list-none rounded-md text-xs font-semibold text-on-surface-variant hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
          Research details
          <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>

        <div className="mt-3 space-y-4">
          {topic.keywords.length > 0 && (
            <div>
              <SectionLabel action={<CopyButton text={topic.keywords.join(", ")} label="Copy keywords" />}>
                Keywords
              </SectionLabel>
              <p className="text-[12px] text-on-surface-variant leading-relaxed">{topic.keywords.join(" · ")}</p>
            </div>
          )}

          <div>
            <SectionLabel>Trend assessment</SectionLabel>
            <p className="text-[13px] text-on-surface font-semibold">{topic.discussion_potential} discussion potential</p>
            <p className="text-[12px] text-on-surface-variant leading-relaxed mt-0.5">{topic.discussion_basis}</p>
            <p className="text-[11px] text-outline mt-1">Research-based assessment, not LinkedIn engagement data.</p>
          </div>

          <div className="flex items-start gap-2 text-[12px] text-on-surface-variant">
            <ShieldCheck size={14} className="shrink-0 mt-0.5 text-primary" aria-hidden="true" />
            <p>
              <span className="font-semibold text-on-surface capitalize">{topic.confidence}</span> source confidence
              {eventDate && <> · Event date {eventDate}</>}
            </p>
          </div>

          <div>
            <SectionLabel action={<CopyButton text={topic.screenshot_reference.url} label="Copy screenshot source link" />}>
              Screenshot
            </SectionLabel>
            <p className="text-[12px] text-on-surface-variant leading-relaxed flex gap-2">
              <Camera size={14} className="shrink-0 mt-0.5 text-primary" aria-hidden="true" />
              <span>{topic.screenshot_reference.description}</span>
            </p>
            <a
              href={topic.screenshot_reference.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1 ml-6 text-[12px] font-semibold text-primary hover:underline"
            >
              Open screenshot source <ExternalLink size={12} aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>

          <div>
            <SectionLabel>Main source</SectionLabel>
            <ReferenceLink reference={topic.primary_reference} />
          </div>

          {topic.secondary_references.length > 0 && (
            <div>
              <SectionLabel>More sources</SectionLabel>
              <div className="space-y-0.5">
                {topic.secondary_references.map((reference) => (
                  <ReferenceLink key={reference.url} reference={reference} />
                ))}
              </div>
            </div>
          )}
        </div>
      </details>
    </article>
  )
}
