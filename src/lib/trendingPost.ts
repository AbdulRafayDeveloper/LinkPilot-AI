import { stripMarkdownMarks } from "@/lib/generatedText"
import type { TrendingTopic } from "@/services/trending/schema"

type PostParts = Pick<TrendingTopic, "post_hook" | "post_body" | "post_cta" | "suggested_hashtags">

// A link in a post costs it reach, so one the model wrote into the text is taken out
const URL_IN_TEXT = /\s*\(?\bhttps?:\/\/[^\s<>"')\]]+\)?/gi
// Hashtags belong in the block at the end, never inside a sentence
const HASHTAG_IN_TEXT = /\s*#[\p{L}\p{N}_]+/gu

/**
 * Tidies the spacing a removal leaves behind, keeping the blank lines between paragraphs that
 * make a post readable in the feed.
 */
function tidySpacing(text: string): string {
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * Post text with every link taken out.
 */
export function stripPostLinks(text: string): string {
  return tidySpacing(text.replace(URL_IN_TEXT, ""))
}

/**
 * Post text with every inline hashtag taken out.
 */
export function stripPostHashtags(text: string): string {
  return tidySpacing(text.replace(HASHTAG_IN_TEXT, ""))
}

/**
 * One line of a post, ready to publish. LinkedIn shows markdown marks as characters, so a
 * model that reached for **bold** would have the asterisks sitting in the published post.
 */
export function cleanPostText(text: string): string {
  return stripMarkdownMarks(text).trim()
}

/**
 * The closing line is the post's one question, so a question the body ends on is dropped.
 * Two asks in a row split the replies and read like a survey.
 */
export function tidyPostBody(body: string): string {
  const lines = cleanPostText(body).split("\n")
  const last = lines[lines.length - 1]?.trim() ?? ""
  if (lines.length > 1 && last.endsWith("?")) {
    return lines.slice(0, -1).join("\n").replace(/\n{3,}/g, "\n\n").trim()
  }
  return cleanPostText(body)
}

/**
 * The ready-to-publish LinkedIn post in posting order: hook, body, the line that asks for
 * replies, then the hashtags. The source link is deliberately left out: LinkedIn shows a post
 * that carries an external link to far fewer people, and the same now goes for a link dropped
 * into its first comment, so the source stays next to the post in the app instead.
 */
export function composeTrendingPost(topic: PostParts): string {
  return [topic.post_hook, topic.post_body, topic.post_cta, topic.suggested_hashtags.join(" ")]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n")
}
