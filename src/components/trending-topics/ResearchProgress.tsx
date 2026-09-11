"use client"

import React from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import type { TrendingStageEntry } from "@/hooks/useTrendingTopicsSearch"

interface ResearchProgressProps {
  stages: TrendingStageEntry[]
}

/**
 * Shows the real backend stages as they stream in. The latest stage is the active one.
 */
export const ResearchProgress: React.FC<ResearchProgressProps> = ({ stages }) => (
  <div className="space-y-4">
    <div role="status" aria-live="polite" className="bg-white border border-outline-variant rounded-2xl shadow-sm p-5">
      <div className="flex items-center gap-3">
        <Loader2 size={20} className="animate-spin text-primary shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-bold text-on-surface">Finding what&apos;s trending right now...</p>
          <p className="text-xs text-on-surface-variant mt-0.5">Live research usually takes 20–60 seconds.</p>
        </div>
      </div>

      {stages.length > 0 && (
        <ol className="mt-4 space-y-2 pl-1">
          {stages.map((stage, index) => {
            const isActive = index === stages.length - 1
            return (
              <li key={`${stage.status}-${index}`} className="flex items-center gap-2 text-[13px]">
                {isActive ? (
                  <Loader2 size={14} className="animate-spin text-primary shrink-0" aria-hidden="true" />
                ) : (
                  <CheckCircle2 size={14} className="text-primary shrink-0" aria-hidden="true" />
                )}
                <span className={isActive ? "text-on-surface font-medium" : "text-on-surface-variant"}>{stage.text}</span>
              </li>
            )
          })}
        </ol>
      )}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 md:gap-5" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className={`bg-white border border-outline-variant rounded-2xl p-5 space-y-4 animate-pulse ${
            index === 2 ? "md:col-span-2 2xl:col-span-1" : ""
          }`}
        >
          <div className="flex justify-between">
            <div className="h-4 w-20 bg-surface-container rounded-full" />
            <div className="h-4 w-16 bg-surface-container rounded-full" />
          </div>
          <div className="h-5 w-4/5 bg-surface-container-high rounded" />
          <div className="space-y-2">
            <div className="h-3 w-full bg-surface-container rounded" />
            <div className="h-3 w-11/12 bg-surface-container rounded" />
          </div>
          <div className="space-y-1.5">
            <div className="h-7 w-full bg-surface-container-low rounded-lg" />
            <div className="h-7 w-full bg-surface-container-low rounded-lg" />
            <div className="h-7 w-full bg-surface-container-low rounded-lg" />
          </div>
          <div className="h-12 w-full bg-surface-container-lowest border-l-2 border-surface-container-high" />
        </div>
      ))}
    </div>
  </div>
)
