"use client"

import React from "react"
import { Send } from "lucide-react"
import { ResultCard } from "@/components/ui/ResultCard"
import { ResultWarning } from "@/components/ui/GeneratedResultPanel"
import { CopyButton } from "@/components/ui/CopyButton"
import { EditableOutput } from "@/components/ui/EditableOutput"
import { useEditableText } from "@/lib/outputEdits"
import { SUBJECT_MAX_LENGTH, getChannelLabel } from "@/constants/clientMessaging"
import type { GenerationStatus } from "@/hooks/useGenerationRequest"
import type { GeneratedClientMessage } from "@/types/clientMessaging"
import { AiSourceLabel } from "@/components/ui/AiSourceLabel"

interface ClientMessageResultProps {
  status: GenerationStatus
  result: GeneratedClientMessage | null
  error: string | null
  onRetry: () => void
}

const partLabel = "text-[10px] font-bold text-outline uppercase tracking-wider"

/**
 * The written message, ready to paste into the channel it was written for: edited in place
 * (with bold), with its own copy action, and an email subject line when the channel has one.
 */
export const ClientMessageResult: React.FC<ClientMessageResultProps> = ({ status, result, error, onRetry }) => {
  const subject = useEditableText("client-message-subject", result?.subject ?? "")
  const message = useEditableText("client-message", result?.message ?? "")

  return (
    <ResultCard
      title="Message to Send"
      status={status === "success" && !result ? "idle" : status}
      error={error}
      onRetry={onRetry}
      idleIcon={Send}
      idleText="Choose a client, say what you want to tell them, pick the channel, and get a formal message in their own format."
      loadingText="Writing the message..."
      headerAction={
        result && <CopyButton text={message.value} label="Copy the message" variant="prominent" buttonText="Copy Message" />
      }
    >
      {result && (
        <>
          {result.subject !== null && (
            <div className="shrink-0">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <h3 className={partLabel}>Subject</h3>
                <CopyButton text={subject.value} label="Copy the subject" variant="prominent" buttonText="Copy Subject" />
              </div>
              <EditableOutput
                text={subject}
                label="Email subject"
                singleLine
                className="bg-surface-container-lowest border border-outline-variant rounded-xl"
                textClassName="text-[15px] font-semibold leading-snug"
              />
              <p className="mt-1 text-[11px] text-outline">
                <span className={subject.value.length > SUBJECT_MAX_LENGTH ? "font-semibold text-error" : ""}>
                  {subject.value.length} / {SUBJECT_MAX_LENGTH} characters
                </span>
              </p>
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col">
            <h3 className={`${partLabel} mb-1.5`}>Message</h3>
            <EditableOutput text={message} label="Client message" />
            <p className="mt-1 text-[11px] text-outline">
              <span className={message.value.length > result.maxCharacters ? "font-semibold text-error" : ""}>
                {message.value.length.toLocaleString()} / {result.maxCharacters.toLocaleString()} characters
              </span>{" "}
              · {getChannelLabel(result.channel)} · saved for {result.clientName}
              <AiSourceLabel source={result} />
            </p>
          </div>

          {result.warning && !message.isEdited && <ResultWarning text={result.warning} />}
        </>
      )}
    </ResultCard>
  )
}
