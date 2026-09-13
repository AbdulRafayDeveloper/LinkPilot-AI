"use client"

import React from "react"
import { Compass, Lightbulb, MessagesSquare, ShieldAlert } from "lucide-react"
import { CONVERSATION_STATES } from "@/constants/conversationState"
import type { ConversationAnalysis } from "@/types/conversationReply"
import { SignalsGrid } from "./SignalsGrid"

const sectionTitle = "text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5"

const BulletList: React.FC<{ items: string[]; emptyText: string }> = ({ items, emptyText }) =>
  items.length > 0 ? (
    <ul className="space-y-1 text-[13px] leading-snug text-on-surface list-disc pl-4 marker:text-outline">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  ) : (
    <p className="text-[12px] text-outline italic">{emptyText}</p>
  )

const AnalysisSkeleton = () => (
  <div className="space-y-3 animate-pulse" aria-hidden="true">
    <div className="h-4 w-3/4 rounded bg-surface-container-high" />
    <div className="h-3 w-full rounded bg-surface-container" />
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index} className="h-[88px] rounded-xl bg-surface-container-low" />
      ))}
    </div>
  </div>
)

interface ConversationAnalysisCardProps {
  analysis: ConversationAnalysis | null
  isLoading: boolean
}

/**
 * The objective read of the conversation: overall assessment, the ten signals, key
 * opportunities and risks, and the recommended next move. Scores are estimates, not guarantees.
 */
export const ConversationAnalysisCard: React.FC<ConversationAnalysisCardProps> = ({ analysis, isLoading }) => {
  const titleId = React.useId()
  const { parties } = analysis ?? {}

  return (
    <section
      aria-labelledby={titleId}
      aria-busy={isLoading}
      className="bg-white border border-outline-variant rounded-2xl shadow-sm p-5 flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={titleId} className="text-sm font-bold text-on-surface">
          Conversation Signals
        </h2>
        <p className="text-[11px] text-outline">Evidence-based estimates, independent of the reply tone</p>
      </div>

      {isLoading && <AnalysisSkeleton />}

      {analysis && parties && (
        <>
          <div>
            <h3 className={sectionTitle}>Overall Assessment</h3>
            <p className="text-[13px] leading-relaxed text-on-surface">{analysis.overallAssessment}</p>
            <p className="mt-1.5 flex items-start gap-1.5 text-[12px] text-on-surface-variant">
              <MessagesSquare size={13} className="shrink-0 mt-0.5 text-primary" aria-hidden="true" />
              <span>
                {CONVERSATION_STATES[parties.state]}
                {parties.otherPersonName && (
                  <> · {parties.userName ? `${parties.userName} with` : "With"} {parties.otherPersonName}</>
                )}
              </span>
            </p>
          </div>

          <SignalsGrid signals={analysis.signals} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h3 className={`${sectionTitle} flex items-center gap-1.5`}>
                <Lightbulb size={12} className="text-primary" aria-hidden="true" />
                Key Opportunities
              </h3>
              <BulletList items={analysis.keyOpportunities} emptyText="No clear opportunity is visible yet." />
            </div>
            <div>
              <h3 className={`${sectionTitle} flex items-center gap-1.5`}>
                <ShieldAlert size={12} className="text-error" aria-hidden="true" />
                Key Risks
              </h3>
              <BulletList items={analysis.keyRisks} emptyText="No specific risks stood out in the evidence." />
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <h3 className={`${sectionTitle} flex items-center gap-1.5 text-primary`}>
              <Compass size={12} aria-hidden="true" />
              Recommended Next Move
            </h3>
            <p className="text-[13px] leading-relaxed text-on-surface">{analysis.recommendedNextMove}</p>
          </div>
        </>
      )}
    </section>
  )
}
