"use client"

import React, { useMemo, useState } from "react"
import {
  CircleHelp,
  Compass,
  FolderOpen,
  Handshake,
  ListChecks,
  Maximize2,
  MessageSquareQuote,
  Pencil,
  ShieldAlert,
  Signpost,
  Target,
  UserSearch,
} from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import { requestApi } from "@/lib/apiClient"
import { conversationOf, projectLinksOf, projectsOf } from "@/lib/meetingScript"
import { ProjectsToShowPanel } from "./ProjectsToShowPanel"
import { MEETING_PLANNER_ENDPOINT, MEETING_PLANNER_MESSAGES } from "@/constants/meetingPlanner"
import type { Evidence, LeadObservation, MeetingPlanDetail, MeetingPrep, MeetingSituation, ScriptStage } from "@/types/meetingPlanner"
import { ConversationScript } from "./ConversationScript"
import { ConversationEditor, endConversationEdit, startConversationEdit, useConversationDraft } from "./ConversationEditor"
import { ConversationFullView } from "./ConversationFullView"

const SITUATION_LABELS: Record<MeetingSituation, string> = {
  they_asked_for_a_project: "They brought a project",
  you_reached_out: "You reached out to them",
  unclear: "Not clear yet, find out early",
}

/** Whether the model read this in what was supplied, or worked it out from it. */
const EvidenceTag: React.FC<{ evidence: Evidence }> = ({ evidence }) => (
  <span
    title={evidence === "stated" ? "Said outright in what you supplied" : "Worked out from what you supplied, not stated"}
    className={`ml-1.5 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
      evidence === "stated" ? "bg-primary-fixed text-on-primary-fixed-variant" : "bg-secondary-fixed text-on-secondary-fixed-variant"
    }`}
  >
    {evidence === "stated" ? "Stated" : "Inferred"}
  </span>
)

const Section: React.FC<{
  icon: React.ElementType
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
}> = ({ icon: Icon, title, subtitle, action, children }) => (
  <section className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <h2 className="flex items-center gap-2 text-sm font-bold text-on-surface">
        <Icon size={16} className="text-primary" aria-hidden="true" />
        {title}
      </h2>
      <div className="flex items-center gap-2">
        {subtitle && <p className="text-[11px] text-outline">{subtitle}</p>}
        {action}
      </div>
    </div>
    {children}
  </section>
)

const Points: React.FC<{ items: string[]; empty?: string }> = ({ items, empty }) =>
  items.length > 0 ? (
    <ul className="list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-on-surface marker:text-outline">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  ) : empty ? (
    <p className="text-[12px] italic text-outline">{empty}</p>
  ) : null

const Observations: React.FC<{ items: LeadObservation[]; empty: string }> = ({ items, empty }) =>
  items.length > 0 ? (
    <ul className="space-y-1.5 text-[13px] leading-relaxed text-on-surface">
      {items.map((item) => (
        <li key={item.point} className="flex flex-wrap items-baseline">
          <span className="mr-1 text-outline">·</span>
          {item.point}
          <EvidenceTag evidence={item.evidence} />
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-[12px] italic text-outline">{empty}</p>
  )

const Heading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-[10px] font-bold uppercase tracking-wider text-outline">{children}</h3>
)

interface MeetingPrepViewProps {
  prep: MeetingPrep
  meetingId: string
  meetingName: string
  // A new preparation is being written, which would replace an edit made now
  isPreparing: boolean
  onMeetingSaved: (meeting: MeetingPlanDetail) => void
}

/**
 * The saved preparation, laid out to be read a few minutes before the call and glanced at
 * during it: why the meeting exists, who they are, what to talk about, what to show them, the
 * introduction, and the conversation stage by stage. Preparations written before the context,
 * projects and introduction existed simply leave those sections out. The conversation can be
 * edited in place (ConversationEditor) and opened on its own to read during the call.
 */
export const MeetingPrepView: React.FC<MeetingPrepViewProps> = ({ prep, meetingId, meetingName, isPreparing, onMeetingSaved }) => {
  const { lead_analysis: lead, discussion_topics: topics, deal_path: deal, cautions } = prep
  // An older preparation is read as a script once, so its stage and step ids stay put between renders
  const stages = useMemo(() => conversationOf(prep), [prep])
  const draft = useConversationDraft()
  const isEditing = draft.meetingId === meetingId
  const [isFullView, setIsFullView] = useState(false)
  const [isSavingConversation, setIsSavingConversation] = useState(false)
  const [conversationError, setConversationError] = useState<string | null>(null)

  const saveConversation = async (next: ScriptStage[]) => {
    setIsSavingConversation(true)
    setConversationError(null)
    try {
      const { data } = await requestApi<MeetingPlanDetail>(`${MEETING_PLANNER_ENDPOINT}/${meetingId}/conversation`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stages: next }),
      })
      onMeetingSaved(data)
      endConversationEdit()
    } catch (error: unknown) {
      setConversationError(error instanceof Error ? error.message : MEETING_PLANNER_MESSAGES.conversationSaveFailed)
    } finally {
      setIsSavingConversation(false)
    }
  }
  const context = prep.meeting_context
  // Read once per preparation, so projects saved before they had ids keep the same ids between renders
  const projects = useMemo(() => projectsOf(prep), [prep])
  const projectLinks = useMemo(() => projectLinksOf(projects), [projects])
  const intro = prep.your_intro?.trim()

  return (
    <div className="flex flex-col gap-5">
      {context && (
        <Section icon={Signpost} title="What this meeting is about">
          <div className="flex flex-col items-start gap-2">
            <span className="rounded-full bg-primary-fixed px-2.5 py-0.5 text-[11px] font-bold text-on-primary-fixed-variant">
              {SITUATION_LABELS[context.situation]}
            </span>
            <p className="text-[13px] leading-relaxed text-on-surface">{context.what_it_is_about}</p>
          </div>
        </Section>
      )}

      <Section icon={UserSearch} title="Who you are meeting" subtitle="From what you supplied, nothing else">
        <div className="flex flex-col gap-3">
          <p className="text-[13px] leading-relaxed text-on-surface">{lead.who_they_are}</p>
          {lead.background && (
            <div>
              <Heading>Background</Heading>
              <p className="mt-1 text-[13px] leading-relaxed text-on-surface">{lead.background}</p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Heading>What they focus on</Heading>
              <div className="mt-1">
                <Observations items={lead.interests} empty="Nothing in what you supplied shows this yet." />
              </div>
            </div>
            <div>
              <Heading>Where you could help</Heading>
              <div className="mt-1">
                <Observations items={lead.needs_and_opportunities} empty="No need is visible in what you supplied." />
              </div>
            </div>
          </div>
          {lead.how_you_can_help.length > 0 && (
            <div>
              <Heading>What you can genuinely offer</Heading>
              <div className="mt-1">
                <Points items={lead.how_you_can_help} />
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {lead.before_you_join.length > 0 && (
              <div className="rounded-xl bg-surface-container-low p-3">
                <Heading>Before you join</Heading>
                <div className="mt-1">
                  <Points items={lead.before_you_join} />
                </div>
              </div>
            )}
            {lead.open_questions.length > 0 && (
              <div className="rounded-xl bg-surface-container-low p-3">
                <Heading>
                  <span className="inline-flex items-center gap-1">
                    <CircleHelp size={11} aria-hidden="true" />
                    Not known, so ask
                  </span>
                </Heading>
                <div className="mt-1">
                  <Points items={lead.open_questions} />
                </div>
              </div>
            )}
          </div>
        </div>
      </Section>

      {topics.length > 0 && (
        <Section icon={Target} title="What to discuss" subtitle="Most relevant first">
          <ol className="space-y-2">
            {topics.map((topic, index) => (
              <li key={topic.topic} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
                <p className="flex flex-wrap items-baseline text-[13px] font-semibold text-on-surface">
                  <span className="mr-2 text-outline tabular-nums">{index + 1}.</span>
                  {topic.topic}
                  <EvidenceTag evidence={topic.evidence} />
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-on-surface-variant">{topic.why_it_matters}</p>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <Section icon={FolderOpen} title="Projects to show them" subtitle="Have these open before the call, in the order you'll show them">
        <ProjectsToShowPanel meetingId={meetingId} projects={projects} disabled={isPreparing} onMeetingSaved={onMeetingSaved} />
      </Section>

      {intro && (
        <Section
          icon={MessageSquareQuote}
          title="Your introduction"
          subtitle="Say this after the greeting"
          action={<CopyButton text={intro} label="Copy your introduction" showLabel />}
        >
          <blockquote className="rounded-xl border-l-4 border-primary bg-primary/5 px-4 py-3 text-[14px] leading-relaxed text-on-surface">
            {intro}
          </blockquote>
        </Section>
      )}

      {stages.length > 0 || isEditing ? (
        <Section
          icon={Compass}
          title="The conversation, start to finish"
          subtitle={isEditing ? "Drag to reorder; numbers follow" : prep.conversation_edited_at ? "Edited by you" : "Say, ask, listen and show, in order"}
          action={
            !isEditing && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsFullView(true)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-outline-variant bg-white px-2.5 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                >
                  <Maximize2 size={13} aria-hidden="true" />
                  Full view
                </button>
                <button
                  type="button"
                  onClick={() => startConversationEdit(meetingId, stages)}
                  disabled={isPreparing}
                  title={isPreparing ? "Wait for the preparation to finish" : "Edit the conversation"}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-outline-variant bg-white px-2.5 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Pencil size={13} aria-hidden="true" />
                  Edit
                </button>
              </div>
            )
          }
        >
          {isEditing ? (
            <ConversationEditor
              projects={projects.map((entry) => entry.project)}
              isSaving={isSavingConversation}
              error={conversationError}
              onSave={saveConversation}
              onCancel={() => {
                endConversationEdit()
                setConversationError(null)
              }}
            />
          ) : (
            <ConversationScript stages={stages} projectLinks={projectLinks} />
          )}
        </Section>
      ) : null}

      <Section icon={Handshake} title="Winning the work" subtitle="Only once the fit is clear">
        <div className="flex flex-col gap-3">
          {deal.signals_to_listen_for.length > 0 && (
            <div>
              <Heading>
                <span className="inline-flex items-center gap-1">
                  <ListChecks size={11} aria-hidden="true" />
                  Listen for
                </span>
              </Heading>
              <div className="mt-1">
                <Points items={deal.signals_to_listen_for} />
              </div>
            </div>
          )}
          {deal.how_to_raise_scope && (
            <div>
              <Heading>Moving to scope</Heading>
              <p className="mt-1 text-[13px] leading-relaxed text-on-surface">{deal.how_to_raise_scope}</p>
            </div>
          )}
          {deal.natural_next_step && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
              <Heading>Next step to suggest</Heading>
              <p className="mt-1 text-[13px] leading-relaxed text-on-surface">{deal.natural_next_step}</p>
            </div>
          )}
        </div>
      </Section>

      {cautions.length > 0 && (
        <Section icon={ShieldAlert} title="Don't claim or assume" subtitle="Nothing you supplied supports these">
          <Points items={cautions} />
        </Section>
      )}
      {isFullView && <ConversationFullView title={meetingName} stages={stages} projectLinks={projectLinks} onClose={() => setIsFullView(false)} />}
    </div>
  )
}
