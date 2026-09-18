/**
 * What a prompt waits for. A prompt the Prompt Creator wrote is run by pasting it into the agent it
 * was written for and then marking it applied, so **applied is what "has run" means here**: a prompt
 * that waits for another can only be marked applied once that one has been. Work written as a series
 * ("set the schema up", then "write the queries", then "write the tests") is therefore run in order,
 * and a prompt can never be ticked off before the work it builds on.
 *
 * Only Prompt Creator has dependencies, so everything about them lives here rather than in the
 * shared saved-outputs registry, exactly as folders do.
 */

// The prompts this one waits for are saved on the prompt itself, so this is the record endpoint
export { PROMPT_CREATOR_RECORD_ENDPOINT } from "./promptFolders"

/** A prompt waits for a handful of others at most; more than this is a plan, not a dependency. */
export const MAX_DEPENDENCIES = 20
// How many prompts the picker offers at once, newest first, before the search narrows them
export const DEPENDENCY_CHOICES = 50

/**
 * The three states a prompt can be in, which are also the three filters. They never overlap and
 * they cover every prompt between them, so the counts always add up:
 * independent (waits for nothing), ready (waits for prompts that have all run), blocked (waits for
 * at least one that hasn't).
 */
export const DEPENDENCY_FILTERS = [
  { id: "independent", label: "Independent" },
  { id: "ready", label: "Ready to run" },
  { id: "blocked", label: "Blocked" },
] as const

export type DependencyState = (typeof DEPENDENCY_FILTERS)[number]["id"]

export const DEPENDENCY_STATE_LABELS: Record<DependencyState, string> = {
  independent: "Independent",
  ready: "Ready",
  blocked: "Blocked",
}

export const PROMPT_DEPENDENCY_MESSAGES = {
  filterLabel: "Dependencies",
  allLabel: "Any dependencies",
  // On the record itself
  dependsOn: "Waits for",
  none: "Waits for nothing",
  ready: "Every prompt this one waits for has run.",
  independent: "This prompt waits for nothing, so it can be run whenever you like.",
  // The row action, kept apart from the "Waits for A, B" tag so the two never read alike
  edit: "Dependencies",
  dialogTitle: "What this prompt waits for",
  dialogHint: "Pick the prompts that must be run before this one. Applied prompts count as run.",
  searchPrompts: "Search your prompts",
  noPromptMatch: "No other prompt matches that name.",
  // The folder the picker lists from, which starts on the prompt's own folder
  folderLabel: "Folder",
  noPromptInFolder: "No other prompt is in this folder. Pick another folder, or All folders.",
  // On the create page, beside the folder
  setDependencies: "Set what it waits for",
  changeDependencies: "Change what it waits for",
  onlyPrompt: "This is your only prompt, so there is nothing for it to wait for yet.",
  // Refusals
  tooMany: `A prompt can wait for up to ${MAX_DEPENDENCIES} others.`,
  itself: "A prompt can't wait for itself.",
  missing: "One of those prompts no longer exists.",
  loop: "That would make a loop: the other prompt already waits for this one.",
  // What the page says when it can't do what was asked
  loadFailed: "Couldn't load your prompts. Please try again.",
  saveFailed: "Couldn't save what this prompt waits for. Please try again.",
} as const

/** What is stopping a blocked prompt from being run, named so the user knows what to run first. */
export function describePending(names: string[]): string {
  if (names.length === 0) return PROMPT_DEPENDENCY_MESSAGES.ready
  const quoted = names.map((name) => `"${name}"`)
  const shown = quoted.length > 3 ? [...quoted.slice(0, 3), `${quoted.length - 3} more`] : quoted
  const list = shown.length === 1 ? shown[0] : `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`
  return `Run ${list} first, then mark ${names.length === 1 ? "it" : "them"} applied.`
}
