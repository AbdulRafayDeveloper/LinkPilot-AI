import { HandCoins, type LucideIcon } from "lucide-react"

/**
 * Finance Bot: a chat that helps one person plan their money and their investments, written for
 * them. Every question is answered with the parts of their own My AI Profile closest to it (found
 * through the vectors that profile is already kept in, `searchMyProfile`), so the guidance fits who they are,
 * where they live and what they earn rather than being the same for everyone.
 *
 * Every word the model reads is a prompt under Administration → Global AI Prompts → Finance Bot:
 * `finance-bot-system` (the rules), `finance-bot` (how it guides, editable) and
 * `finance-bot-instructions` (the labels around the profile and the question).
 */

export const FINANCE_BOT_HREF = "/finance/finance-bot"
export const FINANCE_BOT_CHAT_ENDPOINT = "/api/finance-bot/chat"

// The module's sidebar entry, first under Finance
export const FINANCE_BOT_TOOL: {
  id: string
  title: string
  description: string
  icon: LucideIcon
  href: string
  group: "finance"
} = {
  id: "finance-bot",
  title: "Finance Bot",
  description: "Your own guide to investing and planning",
  icon: HandCoins,
  href: FINANCE_BOT_HREF,
  group: "finance",
}

// One question, and the room its answer gets: a roadmap or a plan runs longer than a meeting answer
export const FINANCE_QUESTION_MAX_LENGTH = 2000
export const FINANCE_ANSWER_MAX_TOKENS = 2000

// The last messages sent with a new question, so a follow-up ("and the second step?") makes sense
export const FINANCE_CHAT_CONTEXT_MESSAGES = 10
// How much of the conversation the page loads and keeps
export const FINANCE_CHAT_HISTORY_LIMIT = 200
// How many pieces of the person's profile one answer is read from, and how close a piece must be to
// count: looser than My AI Profile's own search box, since a broad question ("make me a plan") is
// still about the person even when no single piece of their profile is close to its words
export const FINANCE_PROFILE_MATCHES = 10
export const FINANCE_PROFILE_MIN_SCORE = 0.4

export const FINANCE_BOT_MESSAGES = {
  missingQuestion: "Type a question about your money or your investments.",
  questionTooLong: `A question must be under ${FINANCE_QUESTION_MAX_LENGTH.toLocaleString()} characters.`,
  answerFailed: "Couldn't answer that. Please try again.",
  historyFailed: "Couldn't load the chat. Please try again.",
  clearFailed: "Couldn't clear the chat. Please try again.",
  cleared: "Chat cleared.",
  subtitle: "Answers written for you, from your own My AI Profile: where to invest, a roadmap, a plan and the platforms to use.",
  empty: "Ask how to start investing, where your money should go, or for a step by step plan. Every answer is shaped by what your My AI Profile says about you.",
  pending: "Reading your profile...",
  placeholder: "Ask about investing, saving or a plan for your money...",
  inputLabel: "Your question for the Finance Bot",
  clearDescription: "The questions and answers go. Your My AI Profile stays exactly as it is.",
  fromProfile: (sections: string) => `Shaped by your profile: ${sections}`,
  notFromProfile: "Your profile had nothing on this, so it is general guidance",
  // Shown above the chat when the profile has nothing to read yet
  noProfile: "Your My AI Profile is empty or not searchable yet, so answers can't be shaped to you. Fill it in and the bot will use it.",
  openProfile: "Open My AI Profile",
  disclaimer: "This is guidance to help you understand and plan, not licensed financial advice. Check anything important with a qualified adviser before you invest.",
} as const

// Questions offered on an empty chat, asked with one click
export const FINANCE_BOT_SUGGESTIONS = [
  "Where should I start investing with what I earn now?",
  "Make me a 12 month investment roadmap",
  "Which platforms can I use to invest from my country?",
  "How much should I keep as an emergency fund first?",
] as const
