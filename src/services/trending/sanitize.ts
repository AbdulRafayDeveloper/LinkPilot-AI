import { createTagSanitizer } from "@/lib/sanitize"

/**
 * Removes the delimiter tags used to separate prompt sections, so neither the
 * configured prompt nor web content can close its own section and inject instructions.
 */
export const sanitizeForTag = createTagSanitizer([
  "research_brief",
  "configured_prompt",
  "untrusted_research_data",
  "verified_source_urls",
])
