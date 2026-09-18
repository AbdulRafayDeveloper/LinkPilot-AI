import { MAX_DEPENDENCIES, type DependencyState } from "@/constants/promptDependencies"
import type { PromptDependency } from "@/types/promptCreator"

/**
 * The rules about what a prompt waits for, with nothing else in them: no database, no request, no
 * React, so they can be read and tested on their own (`tests/promptDependencies.test.mjs`). The
 * service and the page both decide with these, so what the list shows and what the server allows can
 * never drift apart.
 *
 * A prompt has run when it has been applied (constants/promptDependencies.ts says why).
 */

/** The prompts this one waits for that have not run yet. */
export const pendingDependencies = (dependencies: readonly PromptDependency[]): PromptDependency[] =>
  dependencies.filter((dependency) => !dependency.appliedAt)

/**
 * Which of the three states a prompt is in. A prompt that waits for nothing is independent, one
 * whose every dependency has run is ready, and one still waiting for any of them is blocked. A
 * dependency that no longer exists is not counted: it can never run again, so waiting for it would
 * block the prompt for ever (the service takes deleted prompts out of the lists anyway).
 */
export function dependencyState(dependencies: readonly PromptDependency[]): DependencyState {
  if (dependencies.length === 0) return "independent"
  return pendingDependencies(dependencies).length > 0 ? "blocked" : "ready"
}

/** Whether the prompt may be marked as run now. */
export const canRun = (dependencies: readonly PromptDependency[]): boolean => dependencyState(dependencies) !== "blocked"

/**
 * What is really saved from what was picked: each prompt once, never itself, and never more than a
 * prompt may wait for. The order the user picked is kept, since it reads as the order to work in.
 */
export function cleanDependencyIds(ids: readonly string[], selfId: string): string[] {
  const kept: string[] = []
  for (const id of ids) {
    const trimmed = id.trim()
    if (!trimmed || trimmed === selfId || kept.includes(trimmed)) continue
    kept.push(trimmed)
  }
  return kept.slice(0, MAX_DEPENDENCIES)
}

/**
 * Whether making `id` wait for `dependencyIds` would make a loop, which would leave every prompt in
 * it blocked for ever. `waitsFor` is what every other prompt already waits for. It answers the id
 * the loop closes on, so the page can name it, or null when the change is safe.
 */
export function findLoop(id: string, dependencyIds: readonly string[], waitsFor: ReadonlyMap<string, readonly string[]>): string | null {
  const seen = new Set<string>()
  const queue = [...dependencyIds]
  while (queue.length > 0) {
    const next = queue.shift() as string
    if (next === id) return next
    if (seen.has(next)) continue
    seen.add(next)
    // A prompt waiting for the one being changed closes the loop as soon as it is reached
    for (const further of waitsFor.get(next) ?? []) {
      if (further === id) return next
      queue.push(further)
    }
  }
  return null
}
