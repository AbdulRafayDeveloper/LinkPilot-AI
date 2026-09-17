import React from "react"
import { describeSource } from "@/constants/aiProviders"

/**
 * "Source: Groq" beside an AI result, in the meta line it sits in. Renders nothing for a result with no
 * source (saved before attribution existed, or from a provider the app no longer has). `prefix` is the
 * separator placed before it when there is something to show, so a meta line never ends in a stray dot.
 */
export const AiSourceLabel: React.FC<{ source: { provider?: string | null; providers?: readonly string[] } | null | undefined; prefix?: string; className?: string }> = ({
  source,
  prefix = " · ",
  className = "",
}) => {
  const text = describeSource(source)
  if (!text) return null
  return (
    <>
      {prefix}
      <span data-ai-source={source?.provider ?? ""} className={className}>
        {text}
      </span>
    </>
  )
}
