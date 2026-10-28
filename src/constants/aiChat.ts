/**
 * The words every chat in the app shares (components/ui/AiChatPanel). What a chat answers from, and
 * how it says so, is each chat's own; these are only what a chat says about itself.
 */
export const AI_CHAT_MESSAGES = {
  answerFailed: "Couldn't answer that. Please try again.",
  historyFailed: "Couldn't load the chat. Please try again.",
  clearFailed: "Couldn't clear the chat. Please try again.",
  loading: "Loading the chat...",
  expanded: "The chat is open on the whole screen.",
  clearTitle: "Clear this chat?",
  clearWarning: "This cannot be undone.",
  suggestionsHeading: "Try one of these",
} as const
