/**
 * Ask this meeting: a chat that answers from the meeting itself. Everything saved on a meeting (the
 * profile, the conversation so far, the extra notes, and the whole preparation the model wrote) is
 * cut into pieces, turned into vectors and kept in MongoDB, so a question only ever carries the few
 * pieces that match it to the model instead of the whole meeting.
 */

// One meeting's chat: its history, a new question, and clearing it
export const MEETING_PLANNER_ENDPOINT_CHAT = (meetingId: string) => `/api/meeting-planner/${meetingId}/chat`

// One question, and the answer it gets
export const QUESTION_MAX_LENGTH = 2000
export const ANSWER_MAX_TOKENS = 900

// How the meeting is cut up: big enough to answer from, small enough that a few pieces fit one prompt
export const CHUNK_MAX_CHARS = 1200
export const CHUNK_OVERLAP_CHARS = 120

// How many pieces of the meeting one question is answered from, and how many candidates are scanned
export const MATCHES_PER_QUESTION = 8
export const SEARCH_CANDIDATES = 120
// A match below this score is too far from the question to be worth putting in front of the model
export const MIN_MATCH_SCORE = 0.3

// The last messages sent with a new question, so a follow-up ("and that term?") makes sense
export const CHAT_CONTEXT_MESSAGES = 8
// How much of the conversation the page loads and keeps
export const CHAT_HISTORY_LIMIT = 200

export const MEETING_CHAT_MESSAGES = {
  missingQuestion: "Type a question about this meeting.",
  questionTooLong: `A question must be under ${QUESTION_MAX_LENGTH.toLocaleString()} characters.`,
  answerFailed: "Couldn't answer that. Please try again.",
  historyFailed: "Couldn't load the chat. Please try again.",
  clearFailed: "Couldn't clear the chat. Please try again.",
  notReady: "This meeting has nothing saved to answer from yet. Add the profile, the conversation so far or the notes, and prepare it.",
  embeddingsUnavailable:
    "Asking a meeting needs an embedding model. Set OPENAI_API_KEY and OPENAI_EMBEDDING_MODEL where the app runs.",
  emptyChat: "Ask anything about this meeting: what to say first, why a topic matters, what a term in the profile means.",
  cleared: "Chat cleared.",
} as const

/** Where one piece of a meeting came from, so an answer can say what it was read from. */
export const MEETING_CHUNK_KINDS = [
  { id: "meeting", label: "Meeting details" },
  { id: "profile", label: "Their profile" },
  { id: "conversation-history", label: "Conversation so far" },
  { id: "notes", label: "Your notes" },
  { id: "lead-analysis", label: "Read of the person" },
  { id: "topics", label: "Topics to cover" },
  { id: "conversation", label: "Conversation plan" },
  { id: "projects", label: "Projects to show" },
  { id: "deal-path", label: "Deal path" },
  { id: "cautions", label: "Cautions" },
] as const
export type MeetingChunkKind = (typeof MEETING_CHUNK_KINDS)[number]["id"]
export const chunkKindLabel = (id: string) => MEETING_CHUNK_KINDS.find((kind) => kind.id === id)?.label ?? id
