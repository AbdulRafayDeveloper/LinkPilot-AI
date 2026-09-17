"use client"

import React from "react"
import { Info } from "lucide-react"
import type { SearchProvider, TrendingResult } from "@/services/trending/schema"
import { TopicCard } from "./TopicCard"

const PROVIDER_LABELS: Record<SearchProvider, string> = {
  groq: "Groq browser search",
  openai: "OpenAI web search",
}
// A search saved by a provider the app no longer uses
const searchedWith = (provider: string) => PROVIDER_LABELS[provider as SearchProvider] ?? "Web search"

export const TrendingResults: React.FC<{ result: TrendingResult }> = ({ result }) => {
  const { topics, notice, research_metadata: metadata } = result

  return (
    <div className="space-y-4">
      {notice && (
        <div
          role="status"
          className="flex items-start gap-2 bg-secondary-fixed/40 border border-secondary-fixed-dim text-on-secondary-fixed-variant rounded-xl px-4 py-3 text-[13px] leading-relaxed"
        >
          <Info size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <p>{notice}</p>
        </div>
      )}

      {topics.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 md:gap-5">
          {topics.map((topic, index) => (
            <TopicCard key={`${topic.primary_reference.url}-${index}`} topic={topic} />
          ))}
        </div>
      )}

      <p className="text-[11px] text-outline">
        Researched {new Date(metadata.searched_at).toLocaleString()} · {metadata.sources_checked} sources checked ·{" "}
        {metadata.candidates_evaluated} candidates evaluated · {searchedWith(metadata.search_provider)}
      </p>
    </div>
  )
}
