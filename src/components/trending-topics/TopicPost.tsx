"use client"

import React from "react"
import { ExternalLink, PenLine } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import { EditableOutput } from "@/components/ui/EditableOutput"
import { LINKEDIN_POST_MAX_CHARS } from "@/constants/linkedinLimits"
import { POST_TARGET_MAX_CHARS, POST_TARGET_MIN_CHARS, getPostFormat } from "@/constants/trending"
import { composeTrendingPost } from "@/lib/trendingPost"
import { useEditableText } from "@/lib/outputEdits"
import type { StoredTrendingTopic } from "@/services/trending/schema"

/**
 * The ready-to-publish post as its own framed box: hook, body, the line that asks for replies
 * and the hashtags, in the order they'll appear on LinkedIn, editable in place (select the hook
 * and press Bold to make it stand out), with one button that copies all of it as edited. Each
 * topic uses a different post format, named on the box. The source link sits under the post
 * rather than inside it, because a post carrying a link reaches far fewer people.
 */
export const TopicPost: React.FC<{ topic: StoredTrendingTopic }> = ({ topic }) => {
  const post = useEditableText("trending-topics", composeTrendingPost(topic))
  const { url } = topic.primary_reference
  // A search saved before posts had a format has none to name
  const format = topic.post_format ? getPostFormat(topic.post_format) : null
  const length = post.value.length
  const isOverLinkedInLimit = length > LINKEDIN_POST_MAX_CHARS
  const isOffTarget = length < POST_TARGET_MIN_CHARS || length > POST_TARGET_MAX_CHARS

  return (
    <section aria-label="Ready-to-post LinkedIn post" className="rounded-xl border border-primary/30 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-primary/5 border-b border-primary/15">
        <h4 className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
          <PenLine size={13} aria-hidden="true" />
          LinkedIn post
          {format && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 normal-case tracking-normal" title={format.description}>
              {format.label}
            </span>
          )}
        </h4>
        <CopyButton text={post.value} label="Copy the complete post" variant="prominent" buttonText="Copy post" />
      </div>

      <div className="px-3 py-3">
        <EditableOutput text={post} label="LinkedIn post" className="rounded-lg bg-surface-container-lowest" textClassName="text-[14px] leading-relaxed" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-1.5 border-t border-outline-variant/60 bg-surface-container-lowest text-[11px] text-outline">
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
          <ExternalLink size={12} aria-hidden="true" />
          Open the source
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        <span
          className={isOverLinkedInLimit ? "text-error font-semibold" : isOffTarget ? "text-on-surface-variant" : ""}
          title={`Posts of ${POST_TARGET_MIN_CHARS.toLocaleString()} to ${POST_TARGET_MAX_CHARS.toLocaleString()} characters reach the most people`}
        >
          {length.toLocaleString()} characters
          {isOverLinkedInLimit
            ? ` · over LinkedIn's ${LINKEDIN_POST_MAX_CHARS.toLocaleString()} limit`
            : ` · aim for ${POST_TARGET_MIN_CHARS.toLocaleString()} to ${POST_TARGET_MAX_CHARS.toLocaleString()}`}
        </span>
      </div>

      <p className="px-4 pb-2 text-[11px] text-outline">
        Keep the link out of the post and its comments. LinkedIn shows posts carrying a link to far fewer people, so name
        the source in the text instead.
      </p>
    </section>
  )
}
