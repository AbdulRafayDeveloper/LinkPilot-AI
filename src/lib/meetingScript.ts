import type { ScriptStepKindId } from "@/constants/meetingPlanner"
import type { MeetingPrep, ProjectToShow, ScriptStage, ScriptStep } from "@/types/meetingPlanner"

/**
 * The conversation script of a meeting preparation: building steps and stages, and reading a
 * preparation of either shape as a script. Shared by the server (ids for a freshly written
 * script) and the page (new steps and stages while editing).
 */

let fallbackCounter = 0
/** A short unique id for a stage or step; only needs to be unique within one meeting. */
export function scriptId(): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID()
  fallbackCounter += 1
  return `${Date.now().toString(36)}-${fallbackCounter}-${Math.random().toString(36).slice(2, 8)}`
}

export function newStep(kind: ScriptStepKindId, text = ""): ScriptStep {
  return { id: scriptId(), kind, text, project: "", minutes: kind === "show_project" ? 5 : 0, features: [] }
}

export function newStage(title = ""): ScriptStage {
  return { id: scriptId(), title, goal: "", steps: [newStep("say")], move_on_when: "" }
}

/**
 * The preparation's conversation as a script. A preparation written before scripts existed has a
 * plan of what to say, questions and a transition per stage; those become Say, Ask (each question
 * its own step, followed by Listen) and a closing Say, so every old preparation can be read and
 * edited the same way.
 */
export function conversationOf(prep: MeetingPrep): ScriptStage[] {
  if (prep.conversation) return prep.conversation
  return (prep.conversation_plan ?? []).map((stage) => {
    const steps: ScriptStep[] = []
    if (stage.what_to_say.trim()) steps.push(newStep("say", stage.what_to_say))
    stage.questions.forEach((question) => steps.push(newStep("ask", question)))
    if (stage.questions.length > 0) steps.push(newStep("listen", "Let them answer fully before you speak again."))
    if (stage.transition.trim()) steps.push(newStep("say", stage.transition))
    return { id: scriptId(), title: stage.stage, goal: stage.goal, steps, move_on_when: stage.move_on_when ?? "" }
  })
}

/** The preparation's projects to show, each with an id and a link field, whatever version wrote them. */
export function projectsOf(prep: MeetingPrep): Required<ProjectToShow>[] {
  return (prep.projects_to_show ?? []).map((entry) => ({
    id: entry.id ?? scriptId(),
    project: entry.project,
    why_it_will_land: entry.why_it_will_land ?? "",
    link: entry.link ?? "",
    added_by_user: entry.added_by_user ?? false,
  }))
}

/** A link as typed ("rafaydev.vercel.app") made into a web address; blank stays blank. */
export function normalizeProjectLink(link: string): string {
  const trimmed = link.trim()
  if (!trimmed) return ""
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
}

/** Each project's link by its name, lowercased, for the conversation's show steps. */
export function projectLinksOf(projects: ProjectToShow[]): Record<string, string> {
  return Object.fromEntries(
    projects.filter((entry) => entry.link).map((entry) => [entry.project.trim().toLowerCase(), entry.link as string])
  )
}
