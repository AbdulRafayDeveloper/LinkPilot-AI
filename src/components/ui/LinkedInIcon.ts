import { createLucideIcon } from "lucide-react"

/**
 * LinkedIn's "in" mark, drawn in lucide's own stroke style so it sits beside the other icons on
 * the sidebar's rail as one of them. lucide-react no longer ships brand marks, which is why it is
 * built here with `createLucideIcon` rather than imported: that gives it the same props, sizing
 * and `className` every other icon takes, so a `LucideIcon` slot accepts it unchanged.
 *
 * It is the LinkedIn Tools area's icon on the rail, at the owner's request: a megaphone read as
 * marketing in general, and the rail is icons alone, so the mark has to say "LinkedIn" by itself.
 */
export const LinkedInIcon = createLucideIcon("LinkedIn", [
  ["path", { d: "M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z", key: "linkedin-n" }],
  ["rect", { width: "4", height: "12", x: "2", y: "9", key: "linkedin-i" }],
  ["circle", { cx: "4", cy: "4", r: "2", key: "linkedin-dot" }],
])
