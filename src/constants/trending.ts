export const TRENDING_TOPIC_COUNT = 6
// Spares. Verification drops a topic whose source or date the research never stated, and two
// candidates often turn out to be the same development, which used to leave the page short
export const TRENDING_CANDIDATE_COUNT = TRENDING_TOPIC_COUNT + 2
export const TRENDING_ERROR_MESSAGE = "Unable to retrieve live trends right now. Please try again."
export const TRENDING_MESSAGES = {
  loadFailed: "Couldn't load the saved topics.",
  clearFailed: "Couldn't remove the saved topics for everyone. Please try Reset again.",
} as const
export const LINKEDIN_CONTENT_SEARCH_URL = "https://www.linkedin.com/search/results/content/"

// A LinkedIn content search for one query, opened from a topic on the search page or the saved topics
export const linkedInSearchUrl = (query: string) => `${LINKEDIN_CONTENT_SEARCH_URL}?keywords=${encodeURIComponent(query)}`

/**
 * The six post formats, one per topic, so a search never returns six posts that read alike.
 * `structure` is what the writing model must follow and what the reader sees on the card.
 * The synthesis prompt receives this list as {{POST_FORMATS}}, so this file is the only
 * place a format is defined.
 */
export const TRENDING_POST_FORMATS = [
  {
    id: "contrarian",
    label: "Contrarian take",
    description: "Argues against the popular reaction",
    structure:
      "Take the opposite side of how people are reacting to this news, and stay honest about it. Line 1 states the stand. Then 2 or 3 short paragraphs give the reasons, each with a concrete detail from the research. Then one paragraph says what you would do instead.",
  },
  {
    id: "story",
    label: "What happened story",
    description: "Tells the news as a short story",
    structure:
      "Tell the development as a short story with a turn. First the situation before it. Then what happened, in 2 or 3 short paragraphs of 1 or 2 lines each. Then the moment it changes something for builders. Then the lesson in one line. Never invent the user's own experience, clients or results.",
  },
  {
    id: "playbook",
    label: "Playbook",
    description: "Steps a founder can run this week",
    structure:
      "Turn the development into steps the reader can act on this week. One short paragraph of setup, then 4 to 6 numbered steps, each on its own line and one sentence long. Then one line on what changes if they do it.",
  },
  {
    id: "numbers",
    label: "Number breakdown",
    description: "Leads with a real figure",
    structure:
      "Build the post around one real number from the research, and never invent or round one. Open with the number and what it replaces. Then a short before and after comparison on separate lines. Then 2 short paragraphs on what it changes for cost, time or risk.",
  },
  {
    id: "myth",
    label: "Myth vs reality",
    description: "Corrects what people assume",
    structure:
      "Correct what people assume about this development. One line naming the belief. Then 3 short blocks, each a belief on one line and what the research actually shows on the next. Then one paragraph on what that means for people building right now.",
  },
  {
    id: "prediction",
    label: "Prediction",
    description: "Where this goes next",
    structure:
      "Say where this goes next and own the call. One line with the prediction and a rough timeframe. Then the signal behind it from the research, in 2 short paragraphs. Then one paragraph on what to do now to be ready, and admit what would prove you wrong.",
  },
] as const

export type TrendingPostFormatId = (typeof TRENDING_POST_FORMATS)[number]["id"]

export const TRENDING_POST_FORMAT_IDS = TRENDING_POST_FORMATS.map((format) => format.id) as [
  TrendingPostFormatId,
  ...TrendingPostFormatId[],
]

export function getPostFormat(id: TrendingPostFormatId): (typeof TRENDING_POST_FORMATS)[number] {
  return TRENDING_POST_FORMATS.find((format) => format.id === id) ?? TRENDING_POST_FORMATS[0]
}

/**
 * Post length and shape, from how LinkedIn distributes posts in 2026: posts under about 500
 * characters read as low effort, 1,200 to 2,000 characters reach furthest, a link in the post
 * (or in its first comment) cuts reach sharply, comments count for more than likes, and more
 * than 5 hashtags is treated as spam. The prompts state the same numbers, and code enforces them.
 */
export const POST_MIN_CHARS = 900
// Under this a post is beyond rescue and the topic is dropped; between the two it is rewritten longer
export const POST_UNUSABLE_CHARS = 400
export const POST_TARGET_MIN_CHARS = 1200
export const POST_TARGET_MAX_CHARS = 2000
export const POST_HOOK_MAX_WORDS = 12
export const POST_HASHTAG_MIN = 3
export const POST_HASHTAG_MAX = 5

/**
 * Existing topics: every topic every search has found, read back from trending_searches. The
 * sidebar's Trending Topics dropdown links here and to the search page.
 */
export const TRENDING_HISTORY_HREF = "/trending-topics/history"
export const TRENDING_HISTORY_ENDPOINT = "/api/trending-topics/history"
// Page size, search length and debounce are the ones every history shares (constants/historyFilters.ts)
export const TRENDING_HISTORY_CATEGORY_MAX_LENGTH = 60

/**
 * Where a saved topic stands. The page shows one search at a time, so a topic is either part of
 * the search on the page now, part of an earlier search, or part of one someone reset.
 */
export const SAVED_TOPIC_STATUSES = [
  { id: "current", label: "On the page now" },
  { id: "earlier", label: "Earlier search" },
  { id: "dismissed", label: "Dismissed" },
] as const

export type SavedTopicStatus = (typeof SAVED_TOPIC_STATUSES)[number]["id"]
export const SAVED_TOPIC_STATUS_IDS = SAVED_TOPIC_STATUSES.map((status) => status.id) as [
  SavedTopicStatus,
  ...SavedTopicStatus[],
]

// Older searches were saved before posts had a format, so "none" is a filter of its own
export const NO_FORMAT_FILTER = "none"

export const TRENDING_HISTORY_MESSAGES = {
  loadFailed: "Couldn't load the saved topics. Please try again.",
  empty: "No topics have been found yet. Run a search and every topic it finds lands here.",
  noResults: "No saved topics match these filters.",
  topicGone: "That topic no longer exists. It may have been deleted already.",
  detailFailed: "Couldn't open this topic. Please try again.",
  unreadable: "This topic was saved in a shape the app can no longer show in full.",
  deleteFailed: "Couldn't delete the topic. It is back in the list, so please try again.",
  deleted: "Topic deleted.",
} as const

// The longest topic title a delete or a detail request may name
export const SAVED_TOPIC_TITLE_MAX_LENGTH = 500
