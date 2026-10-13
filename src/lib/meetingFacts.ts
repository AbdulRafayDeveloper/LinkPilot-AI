import type { AggregatedFacts } from "@/services/meetings/aggregate"

/**
 * Whether a meeting's merged notes hold anything a summary could be written from.
 *
 * **Participants alone do not count.** A recording of someone testing their microphone still gives
 * one unnamed speaker, and that is not a meeting; neither is a list of what nobody settled
 * (`unknowns`), which says what is missing rather than what happened.
 *
 * This is what tells apart the two reasons the minutes can come back empty: the model failing to
 * write them, which is worth refusing and trying another provider for, and **the recording simply
 * having nothing in it**, which is an answer about the recording. Treating the second as a failure
 * is what used to send a microphone test through every provider and end as "Groq wrote something
 * the app could not use" — blaming the model, and naming env vars that had nothing to do with it.
 *
 * It is here rather than in the service so the rule can be read and tested on its own.
 */
export const hasMeetingSubstance = (facts: Pick<AggregatedFacts, "purpose" | "topics" | "decisions" | "actionItems" | "myTasks" | "myDecisions" | "clientRequests">): boolean =>
  Boolean(facts.purpose?.trim()) ||
  facts.topics.length > 0 ||
  facts.decisions.length > 0 ||
  facts.actionItems.length > 0 ||
  facts.myTasks.length > 0 ||
  facts.myDecisions.length > 0 ||
  facts.clientRequests.length > 0
