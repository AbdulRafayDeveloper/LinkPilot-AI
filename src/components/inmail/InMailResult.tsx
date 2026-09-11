"use client"

import React from "react"
import { Mail } from "lucide-react"
import { ResultCard } from "@/components/ui/ResultCard"
import { ResultWarning } from "@/components/ui/GeneratedResultPanel"
import { CopyButton } from "@/components/ui/CopyButton"
import { AboutMeNotice, AnalysisDetails } from "@/components/outreach/OutreachResultExtras"
import { getOutreachTuneLabel } from "@/constants/outreachTunes"
import type { GenerationStatus } from "@/hooks/useGenerationRequest"
import type { GeneratedInMail } from "@/types/inmail"

interface InMailResultProps {
  status: GenerationStatus
  result: GeneratedInMail | null
  error: string | null
  onRetry: () => void
  onOpenAboutMe: () => void
}

const partLabel = "text-[10px] font-bold text-outline uppercase tracking-wider"

/**
 * Shows the InMail as two independent parts, subject and message, each with its own copy action.
 */
export const InMailResult: React.FC<InMailResultProps> = ({ status, result, error, onRetry, onOpenAboutMe }) => (
  <ResultCard
    title="Generated InMail"
    status={status === "success" && !result ? "idle" : status}
    error={error}
    onRetry={onRetry}
    idleIcon={Mail}
    idleText="Paste the person's profile, pick a tune, and generate a personalized InMail subject and message."
    loadingText="Writing your InMail..."
  >
    {result && (
      <>
        <div className="shrink-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <h3 className={partLabel}>Subject</h3>
            <CopyButton text={result.subject} label="Copy InMail subject" variant="prominent" buttonText="Copy Subject" />
          </div>
          <p className="text-[15px] font-semibold text-on-surface bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-2.5 break-words">
            {result.subject}
          </p>
          <p className="text-[11px] text-outline mt-1">
            {result.subjectCharacters} / {result.subjectMaxCharacters} characters
          </p>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <h3 className={partLabel}>Message</h3>
            <CopyButton text={result.message} label="Copy InMail message" variant="prominent" buttonText="Copy Message" />
          </div>
          <blockquote className="min-h-0 overflow-y-auto text-[15px] leading-relaxed text-on-surface whitespace-pre-wrap break-words border-l-2 border-primary bg-surface-container-lowest rounded-r-xl px-4 py-3">
            {result.message}
          </blockquote>
          <p className="text-[11px] text-outline mt-1">
            {result.messageCharacters.toLocaleString()} / {result.messageMaxCharacters.toLocaleString()} characters ·{" "}
            {getOutreachTuneLabel(result.tune)} tune
          </p>
        </div>

        {result.warning && <ResultWarning text={result.warning} />}
        {!result.usedSenderProfile && <AboutMeNotice outputName="InMail" onOpenAboutMe={onOpenAboutMe} />}
        <AnalysisDetails keyDetail={result.analysis.keyDetail} senderLink={result.analysis.senderLink} />
      </>
    )}
  </ResultCard>
)
