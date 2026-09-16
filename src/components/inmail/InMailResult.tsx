"use client"

import React from "react"
import { Mail } from "lucide-react"
import { ResultCard } from "@/components/ui/ResultCard"
import { ResultWarning } from "@/components/ui/GeneratedResultPanel"
import { CopyButton } from "@/components/ui/CopyButton"
import { EditableOutput } from "@/components/ui/EditableOutput"
import { useEditableText } from "@/lib/outputEdits"
import { AboutMeNotice, AnalysisDetails } from "@/components/outreach/OutreachResultExtras"
import { getInMailTuneLabel } from "@/constants/inmail"
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
 * Shows the InMail as two independent parts, subject and message, each editable in place (with
 * bold) and with its own copy action for the edited text.
 */
export const InMailResult: React.FC<InMailResultProps> = ({ status, result, error, onRetry, onOpenAboutMe }) => {
  const subject = useEditableText("inmail-subject", result?.subject ?? "")
  const message = useEditableText("inmail-message", result?.message ?? "")

  return (
    <ResultCard
      title="Generated InMail"
      status={status === "success" && !result ? "idle" : status}
      error={error}
      onRetry={onRetry}
      idleIcon={Mail}
      idleText="Paste the person's profile, pick a tone, and generate a personalized InMail subject and message."
      loadingText="Writing your InMail..."
    >
      {result && (
        <>
          <div className="shrink-0">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <h3 className={partLabel}>Subject</h3>
              <CopyButton text={subject.value} label="Copy InMail subject" variant="prominent" buttonText="Copy Subject" />
            </div>
            <EditableOutput
              text={subject}
              label="InMail subject"
              singleLine
              className="bg-surface-container-lowest border border-outline-variant rounded-xl"
              textClassName="text-[15px] font-semibold leading-snug"
            />
            <p className="text-[11px] text-outline mt-1">
              <span className={subject.value.length > result.subjectMaxCharacters ? "text-error font-semibold" : ""}>
                {subject.value.length} / {result.subjectMaxCharacters} characters
              </span>
            </p>
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <h3 className={partLabel}>Message</h3>
              <CopyButton text={message.value} label="Copy InMail message" variant="prominent" buttonText="Copy Message" />
            </div>
            <EditableOutput text={message} label="InMail message" />
            <p className="text-[11px] text-outline mt-1">
              <span className={message.value.length > result.messageMaxCharacters ? "text-error font-semibold" : ""}>
                {message.value.length.toLocaleString()} / {result.messageMaxCharacters.toLocaleString()} characters
              </span>{" "}
              · {getInMailTuneLabel(result.tune)} tone
            </p>
          </div>

          {result.warning && !subject.isEdited && !message.isEdited && <ResultWarning text={result.warning} />}
          {!result.usedSenderProfile && <AboutMeNotice outputName="InMail" onOpenAboutMe={onOpenAboutMe} />}
          <AnalysisDetails keyDetail={result.analysis.keyDetail} senderLink={result.analysis.senderLink} />
        </>
      )}
    </ResultCard>
  )
}
