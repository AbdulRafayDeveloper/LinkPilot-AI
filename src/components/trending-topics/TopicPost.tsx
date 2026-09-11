"use client"

import React from "react"
import { ExternalLink, PenLine } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import { LINKEDIN_POST_MAX_CHARS } from "@/constants/linkedinLimits"
import { composeTrendingPost } from "@/lib/trendingPost"
import type { TrendingTopic } from "@/services/trending/schema"

/**
 * The ready-to-publish post as its own framed box: hook, body, source link and hashtags,
 * laid out the way they'll appear on LinkedIn, with one button that copies all of it.
 */
export const TopicPost: React.FC<{ topic: TrendingTopic }> = ({ topic }) => {
  const post = composeTrendingPost(topic)
  const { url } = topic.primary_reference

  return (
    <section aria-label="Ready-to-post LinkedIn post" className="rounded-xl border border-primary/30 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-primary/5 border-b border-primary/15">
        <h4 className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
          <PenLine size={13} aria-hidden="true" />
          LinkedIn post
        </h4>
        <CopyButton text={post} label="Copy the complete post" variant="prominent" buttonText="Copy post" />
      </div>

      <div className="px-4 py-3.5 space-y-3 text-[14px] leading-relaxed text-on-surface break-words">
        <p className="text-[15px] font-bold leading-snug">{topic.post_hook}</p>
        <p>{topic.post_body}</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-1.5 text-[13px] text-primary hover:underline break-all"
        >
          <ExternalLink size={13} className="shrink-0 mt-[3px]" aria-hidden="true" />
          <span>{url}</span>
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        {topic.suggested_hashtags.length > 0 && (
          <p className="text-[13px] font-semibold text-primary">{topic.suggested_hashtags.join(" ")}</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 px-4 py-1.5 border-t border-outline-variant/60 bg-surface-container-lowest text-[11px] text-outline">
        <span>Hook · body · source · hashtags</span>
        <span>
          {post.length.toLocaleString()} / {LINKEDIN_POST_MAX_CHARS.toLocaleString()} characters
        </span>
      </div>
    </section>
  )
}
