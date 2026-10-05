"use client"

import React from "react"
import { MessageSquareText } from "lucide-react"
import { useCommentCount } from "@/hooks/useCommentCount"

/**
 * How many comments have been written: today's number, with the whole total beside it. It is a
 * reminder of how much commenting has been done, for every post and every person together, so it
 * counts the account's own comments and names nobody. Nothing shows until it has been read.
 */
export const CommentCountBadge: React.FC = () => {
  const { status, today, total } = useCommentCount()
  if (status !== "ready") return null
  return (
    <p
      className="mt-2 inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low px-3 py-1.5 text-xs text-on-surface-variant"
      title={`${total.toLocaleString()} comments written in all`}
    >
      <MessageSquareText size={14} className="shrink-0 text-primary" aria-hidden="true" />
      <span>
        <span className="font-bold text-primary">{today.toLocaleString()}</span>{" "}
        {today === 1 ? "comment" : "comments"} written today
      </span>
      <span className="text-outline">·</span>
      <span className="text-outline">{total.toLocaleString()} in all</span>
    </p>
  )
}
