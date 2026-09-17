import { z } from "zod"
import {
  MAX_PROJECTS_TO_SHOW,
  MEETING_PLANNER_MESSAGES,
  PROJECT_LINK_MAX_LENGTH,
  PROJECT_NOTE_MAX_LENGTH,
  SCRIPT_FEATURE_MAX_LENGTH,
  SCRIPT_MAX_FEATURES,
  SCRIPT_MAX_MINUTES,
  SCRIPT_MAX_STAGES,
  SCRIPT_MAX_STEPS_PER_STAGE,
  SCRIPT_STEP_KIND_IDS,
  SCRIPT_TEXT_MAX_LENGTH,
  SCRIPT_TITLE_MAX_LENGTH,
} from "@/constants/meetingPlanner"

const ScriptIdSchema = z.string().trim().min(1).max(64)

export const ScriptStepSchema = z.object({
  id: ScriptIdSchema,
  kind: z.enum(SCRIPT_STEP_KIND_IDS),
  text: z.string().max(SCRIPT_TEXT_MAX_LENGTH),
  project: z.string().trim().max(SCRIPT_TITLE_MAX_LENGTH),
  minutes: z.number().int().min(0).max(SCRIPT_MAX_MINUTES),
  features: z.array(z.string().trim().min(1).max(SCRIPT_FEATURE_MAX_LENGTH)).max(SCRIPT_MAX_FEATURES),
})

export const ScriptStageSchema = z.object({
  id: ScriptIdSchema,
  title: z.string().trim().min(1, MEETING_PLANNER_MESSAGES.conversationInvalid).max(SCRIPT_TITLE_MAX_LENGTH),
  goal: z.string().trim().max(SCRIPT_TEXT_MAX_LENGTH),
  steps: z.array(ScriptStepSchema).max(SCRIPT_MAX_STEPS_PER_STAGE),
  move_on_when: z.string().trim().max(SCRIPT_TEXT_MAX_LENGTH),
})

/** An edited conversation, as the page saves it. Ids must be unique, since the page keys rows by them. */
export const ConversationScriptSchema = z
  .object({
    stages: z.array(ScriptStageSchema).max(SCRIPT_MAX_STAGES),
  })
  .refine(({ stages }) => {
    const ids = stages.flatMap((stage) => [stage.id, ...stage.steps.map((step) => step.id)])
    return new Set(ids).size === ids.length
  }, MEETING_PLANNER_MESSAGES.conversationInvalid)

const ProjectToShowSchema = z.object({
  id: ScriptIdSchema,
  project: z.string().trim().min(1, MEETING_PLANNER_MESSAGES.projectNameMissing).max(SCRIPT_TITLE_MAX_LENGTH),
  why_it_will_land: z.string().trim().max(PROJECT_NOTE_MAX_LENGTH),
  link: z
    .string()
    .trim()
    .max(PROJECT_LINK_MAX_LENGTH)
    .refine((link) => link === "" || /^https?:\/\/[^\s]+$/i.test(link), MEETING_PLANNER_MESSAGES.projectLinkInvalid),
  added_by_user: z.boolean(),
})

/** The projects to show, as the page saves them after an add, an edit, a removal or a drag. */
export const ProjectsToShowSchema = z.object({
  projects: z.array(ProjectToShowSchema).max(MAX_PROJECTS_TO_SHOW),
})
