"use client"

import React from "react"
import { Languages } from "lucide-react"
import { ResultCard } from "@/components/ui/ResultCard"
import { CopyButton } from "@/components/ui/CopyButton"
import { EditableOutput } from "@/components/ui/EditableOutput"
import { useEditableText } from "@/lib/outputEdits"
import type { GenerationStatus } from "@/hooks/useGenerationRequest"
import type { RewrittenMessage } from "@/types/messageRewriter"

interface RewrittenMessageResultProps {
  status: GenerationStatus
  result: RewrittenMessage | null
  error: string | null
  onRetry: () => void
}

/**
 * The short English message, edited in place before it is sent. Copy always takes the text as
 * it now reads, so an edit is never left behind.
 */
export const RewrittenMessageResult: React.FC<RewrittenMessageResultProps> = ({ status, result, error, onRetry }) => {
  const message = useEditableText("rewritten-message", result?.message ?? "")
  const saved = result ? result.originalCharacters - message.value.length : 0

  return (
    <ResultCard
      title="Short English Message"
      status={status === "success" && !result ? "idle" : status}
      error={error}
      onRetry={onRetry}
      idleIcon={Languages}
      idleText="Write, paste or speak a message in any language, and get it back as a short, clear English message you can send."
      loadingText="Rewriting your message..."
      headerAction={
        result && <CopyButton text={message.value} label="Copy the message" variant="prominent" buttonText="Copy Message" />
      }
    >
      {result && (
        <div className="flex min-h-0 flex-1 flex-col">
          <EditableOutput text={message} label="Rewritten message" />
          <p className="mt-1 text-[11px] text-outline">
            {message.value.length.toLocaleString()} characters, from {result.originalCharacters.toLocaleString()}
            {saved > 0 && ` · ${saved.toLocaleString()} shorter`}
            {result.sourceLanguage.toLowerCase() !== "english" && ` · translated from ${result.sourceLanguage}`}
          </p>
        </div>
      )}
    </ResultCard>
  )
}
