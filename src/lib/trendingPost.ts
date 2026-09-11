import type { TrendingTopic } from "@/services/trending/schema"

/**
 * The complete, ready-to-publish LinkedIn post for a topic, in posting order: hook,
 * body, the primary reference link, then the hashtags. One copy gives the whole post.
 */
export function composeTrendingPost(topic: Pick<TrendingTopic, "post_hook" | "post_body" | "primary_reference" | "suggested_hashtags">): string {
  return [topic.post_hook, topic.post_body, topic.primary_reference.url, topic.suggested_hashtags.join(" ")]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n")
}
