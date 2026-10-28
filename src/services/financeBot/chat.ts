import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages"
import { streamTextWithFallback, type ModelProvider } from "@/services/ai"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { loadPromptBook } from "@/services/promptBook"
import { searchMyProfile } from "@/services/myProfile/vectors"
import { PROFILE_INFO_TAB, sectionById } from "@/constants/profileSections"
import { FINANCE_ANSWER_MAX_TOKENS, FINANCE_CHAT_CONTEXT_MESSAGES, FINANCE_PROFILE_MATCHES, FINANCE_PROFILE_MIN_SCORE } from "@/constants/financeBot"
import type { ProfileSearchMatch } from "@/types/myProfile"
import type { FinanceChatMessage } from "@/types/financeBot"

/**
 * Asking the Finance Bot a question.
 *
 * The person's own My AI Profile is searched twice in its vectors: once with the question, and once
 * with a standing question about their money, work and circumstances (the `profile-query` section of
 * `finance-bot-instructions`), because a broad question such as "make me a plan" is about the person
 * even when no piece of their profile is close to its words. The closest pieces go to the model with
 * the last few messages of the chat, under the fixed `finance-bot-system` rules and the editable
 * `finance-bot` guidance, and the answer is written as it arrives.
 *
 * A profile that cannot be searched (nothing written yet, or the vectors unavailable) never stops the
 * chat: the bot is told so, answers generally, and asks the person for what it would need to know.
 */

export interface FinanceAnswer {
  text: string
  provider: ModelProvider
  // The sections of the profile the answer was shaped by
  sources: string[]
  fromProfile: boolean
}

interface AskOptions {
  ownerId: string
  personName: string
  question: string
  // The chat so far, oldest first
  history: FinanceChatMessage[]
  signal: AbortSignal
  onToken: (text: string) => void
}

const sectionLabel = (section: string) => (section === PROFILE_INFO_TAB || section === "profile-info" ? "Profile Info" : (sectionById(section)?.label ?? section))

// One search; a profile that cannot be searched is the same as one with nothing on the question
async function search(ownerId: string, query: string, signal: AbortSignal): Promise<ProfileSearchMatch[]> {
  try {
    return await searchMyProfile(ownerId, query, signal, { limit: FINANCE_PROFILE_MATCHES, minScore: FINANCE_PROFILE_MIN_SCORE })
  } catch (error: unknown) {
    if (signal.aborted) throw error
    console.warn("⚠️ Finance Bot couldn't search the profile:", error instanceof Error ? error.message : error)
    return []
  }
}

/** The closest pieces of both searches, each piece once, closest first. */
function mergeMatches(groups: ProfileSearchMatch[][]): ProfileSearchMatch[] {
  const best = new Map<string, ProfileSearchMatch>()
  for (const match of groups.flat()) {
    const key = `${match.sourceId}\n${match.text}`
    const seen = best.get(key)
    if (!seen || match.score > seen.score) best.set(key, match)
  }
  return [...best.values()].sort((left, right) => right.score - left.score).slice(0, FINANCE_PROFILE_MATCHES)
}

export async function askFinanceBot({ ownerId, personName, question, history, signal, onToken }: AskOptions): Promise<FinanceAnswer> {
  const book = await loadPromptBook("finance-bot-instructions")
  const [systemTemplate, guidance, ...found] = await Promise.all([
    loadPrompt("finance-bot-system"),
    loadPrompt("finance-bot"),
    search(ownerId, question, signal),
    search(ownerId, book.text("profile-query"), signal),
  ])
  const matches = mergeMatches(found)

  const system = `${renderPrompt(systemTemplate, {
    PERSON_NAME: personName.trim() || book.text("person-unknown"),
    TODAY: new Date().toISOString().slice(0, 10),
  })}\n\n${guidance}`
  const profile =
    matches.length > 0
      ? `${book.text("profile-heading")}\n\n${matches.map((match, index) => `[${index + 1}] ${sectionLabel(match.section)}\n${match.text}`).join("\n\n")}`
      : book.text("profile-empty")

  const messages = [
    new SystemMessage(system),
    ...history
      .slice(-FINANCE_CHAT_CONTEXT_MESSAGES)
      .map((message) => (message.role === "you" ? new HumanMessage(message.text) : new AIMessage(message.text))),
    new HumanMessage(book.text("question", { profile, question })),
  ]

  const { text, provider } = await streamTextWithFallback({ messages, onToken, maxTokens: FINANCE_ANSWER_MAX_TOKENS, temperature: 0.3, signal })
  const sources = [...new Set(matches.map((match) => sectionLabel(match.section)))]
  // Lengths and counts only: what the person asked and what their profile says are never logged
  console.info("💰 Finance Bot answered", { provider, matches: matches.length, characters: text.length })
  return { text: text.trim(), provider, sources, fromProfile: matches.length > 0 }
}
