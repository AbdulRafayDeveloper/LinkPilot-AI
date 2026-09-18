/**
 * Ask this meeting: a chat that answers from the meeting itself. Everything saved on a meeting (the
 * profile, the conversation so far, the extra notes, and the whole preparation the model wrote) is
 * cut into pieces, turned into vectors and kept in MongoDB, so a question only ever carries the few
 * pieces that match it to the model instead of the whole meeting.
 */

// One meeting's chat: its history, a new question, and clearing it
export const MEETING_PLANNER_ENDPOINT_CHAT = (meetingId: string) => `/api/meeting-planner/${meetingId}/chat`
// The same three things for a meeting that has already happened, answered from its notes
export const MEETING_NOTES_ENDPOINT_CHAT = (meetingId: string) => `/api/meetings/${meetingId}/chat`

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
  // The same chat, on a meeting that has already happened
  notesNotReady: "This meeting has nothing to answer from yet. Save its transcript, and analyse it for the decisions and action items.",
  emptyNotesChat: "Ask anything about this meeting: what was decided, who agreed to do what, why something came up, what a term meant.",
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
  // A meeting that has already happened: the transcript itself and the analysis built from it
  { id: "transcript", label: "What was said" },
  { id: "purpose", label: "Purpose of the meeting" },
  { id: "participants", label: "Who was there" },
  { id: "decisions", label: "Decisions" },
  { id: "action-items", label: "Action items" },
  { id: "my-tasks", label: "My tasks" },
  { id: "client-requests", label: "What the client asked for" },
  { id: "minutes", label: "Minutes of meeting" },
  { id: "unknowns", label: "Left unanswered" },
] as const
export type MeetingChunkKind = (typeof MEETING_CHUNK_KINDS)[number]["id"]
export const chunkKindLabel = (id: string) => MEETING_CHUNK_KINDS.find((kind) => kind.id === id)?.label ?? id

/**
 * The two places a meeting can be asked questions, and the only things that differ between them:
 * where the chat lives, which module reads the speech, and the words on the page. The panel itself
 * (components/meeting-planner/MeetingChatPanel) is the same for both, so a change to how the chat
 * behaves is made once. A third surface is a new entry here, not a second panel.
 */
export const MEETING_CHAT_SURFACES = {
  // Before the meeting: the profile, the notes and the preparation written for it
  plan: {
    endpoint: MEETING_PLANNER_ENDPOINT_CHAT,
    transcribeFor: "meeting-planner",
    subtitle: (subject: string) => `Answers from everything saved on ${subject}. Ask anything you want to understand before the call.`,
    empty: MEETING_CHAT_MESSAGES.emptyChat,
    notReady: MEETING_CHAT_MESSAGES.notReady,
    clearDescription: "The questions and answers go. The meeting, its preparation and what the chat reads from stay as they are.",
  },
  // After the meeting: the transcript exactly as it was pasted, and the analysis built from it
  notes: {
    endpoint: MEETING_NOTES_ENDPOINT_CHAT,
    transcribeFor: "meetings",
    subtitle: (subject: string) => `Answers from the notes of ${subject}: what was said, what was decided and what was agreed.`,
    empty: MEETING_CHAT_MESSAGES.emptyNotesChat,
    notReady: MEETING_CHAT_MESSAGES.notesNotReady,
    clearDescription: "The questions and answers go. The meeting, its transcript and its analysis stay as they are.",
  },
} as const
export type MeetingChatSurfaceId = keyof typeof MEETING_CHAT_SURFACES
