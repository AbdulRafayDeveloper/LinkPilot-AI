export const TRENDING_TOPIC_COUNT = 6
export const TRENDING_PROMPT_SETTING_KEY = "trending_topics_prompt"
export const TRENDING_ERROR_MESSAGE = "Unable to retrieve live trends right now. Please try again."
export const TRENDING_MESSAGES = {
  readOnly: "The saved topics can't be changed on this server because its file system is read-only.",
  loadFailed: "Couldn't load the saved topics.",
  clearFailed: "Couldn't remove the saved topics for everyone. Please try Reset again.",
} as const
export const LINKEDIN_CONTENT_SEARCH_URL = "https://www.linkedin.com/search/results/content/"
