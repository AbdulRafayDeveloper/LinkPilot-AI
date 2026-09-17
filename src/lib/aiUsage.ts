/**
 * Reading how many tokens an AI call used, from whichever shape its SDK answers with:
 * LangChain's `usage_metadata` (input_tokens, output_tokens, total_tokens), the chat completions
 * `usage` of Groq and OpenAI (prompt_tokens, completion_tokens, total_tokens), and OpenAI's images and
 * transcription `usage` (input_tokens, output_tokens, total_tokens, or seconds for a recording).
 * Anything missing is null rather than a guess, so a budget never counts tokens nobody reported.
 */
export interface TokenCounts {
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  audioSeconds: number | null
}

const numberOr = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null)

const asRecord = (value: unknown): Record<string, unknown> | null => (value && typeof value === "object" ? (value as Record<string, unknown>) : null)

export function readTokenUsage(usage: unknown): TokenCounts {
  const record = asRecord(usage)
  if (!record) return { inputTokens: null, outputTokens: null, totalTokens: null, audioSeconds: null }
  const inputTokens = numberOr(record.input_tokens) ?? numberOr(record.prompt_tokens)
  const outputTokens = numberOr(record.output_tokens) ?? numberOr(record.completion_tokens)
  const totalTokens = numberOr(record.total_tokens) ?? (inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null)
  return { inputTokens, outputTokens, totalTokens, audioSeconds: numberOr(record.seconds) }
}
