import { PASTED_SOURCE, tidyPastedText } from "@/lib/pastedText"
import { createTagSanitizer } from "@/lib/sanitize"
import { renderPrompt } from "@/services/prompts"

export interface PromptDataBlock {
  // Placeholder name used in prompts, e.g. "profile_data" for {{profile_data}}
  variable: string
  // Delimiter tag the content is wrapped in
  tag: string
  // Heading used when the prompt doesn't place the block itself
  label: string
  content: string | null
  // Shown instead of a tagged block when there is no content
  emptyText?: string
  // Copied off a LinkedIn page (a profile, a post, a conversation): the page's own chrome is left out
  pasted?: boolean
}

const DEFAULT_EMPTY_TEXT = "Not provided."

/**
 * Builds the user message from a saved prompt and data blocks. Each block is wrapped in
 * delimiter tags that neither the prompt nor the content can close, since those tags are
 * stripped from every input. {{variable}} places a block where the prompt wants it;
 * blocks the prompt doesn't place are appended under their label. `variables` are plain
 * substitutions such as {{tone}}.
 */
export function composePromptMessage(
  template: string,
  blocks: PromptDataBlock[],
  variables: Record<string, string> = {}
): string {
  const stripTags = createTagSanitizer(blocks.map((block) => block.tag))
  const cleanTemplate = stripTags(template)

  const renderedBlocks = Object.fromEntries(
    blocks.map((block) => {
      const content = block.content ? stripTags(block.pasted ? tidyPastedText(block.content) : block.content).trim() : ""
      const open = block.pasted ? `<${block.tag} ${PASTED_SOURCE}>` : `<${block.tag}>`
      return [block.variable, content ? `${open}\n${content}\n</${block.tag}>` : block.emptyText ?? DEFAULT_EMPTY_TEXT]
    })
  )

  const body = renderPrompt(cleanTemplate, { ...variables, ...renderedBlocks })
  const appended = blocks
    .filter((block) => !cleanTemplate.includes(`{{${block.variable}}}`))
    .map((block) => `${block.label}:\n${renderedBlocks[block.variable]}`)

  return [body, ...appended].join("\n\n")
}
