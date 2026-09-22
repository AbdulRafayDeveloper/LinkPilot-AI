import { toolsFor } from "@/constants/linkedinTools"
import { ALWAYS_OPEN_PATH, HOME_PATH } from "@/constants/auth"

/**
 * Where to send an account that can't stay where it is (a tool turned off for it, or the admin area
 * for a user): Connection Note when it may use it, otherwise the first tool it may, and, only when it
 * may use none of them, Global AI Prompts, which is never turned off. Never the tool it was turned
 * away from: sending it to a fixed home that was itself turned off is what sent such an account round
 * in a loop.
 */
export function homeFor(isAdmin: boolean, disabledTools: readonly string[]): string {
  const tools = toolsFor(isAdmin, disabledTools)
  return tools.find((tool) => tool.href === HOME_PATH)?.href ?? tools[0]?.href ?? ALWAYS_OPEN_PATH
}
