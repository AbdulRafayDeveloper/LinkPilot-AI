"use client"

import React from "react"
import { CheckSquare, ClipboardList, Gavel, HelpCircle, MessageSquareQuote, Target, UserCheck, Users } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import type { ActionItem, MeetingAnalysis, MeetingDecision } from "@/types/meetings"

interface MeetingAnalysisViewProps {
  analysis: MeetingAnalysis
}

// What the section's Copy button puts on the clipboard: the content itself, never the labels
const taskLines = (items: ActionItem[]) =>
  items.map((item) => `- ${item.task}${item.owner ? ` (${item.owner}` : ""}${item.owner && item.deadline ? `, ${item.deadline}` : ""}${item.owner ? ")" : item.deadline ? ` (${item.deadline})` : ""}`).join("\n")
const decisionLines = (decisions: MeetingDecision[]) => decisions.map((entry) => `- ${entry.decision}`).join("\n")
const plainLines = (values: string[]) => values.map((value) => `- ${value}`).join("\n")

const Inferred: React.FC<{ evidence: "stated" | "inferred" }> = ({ evidence }) =>
  evidence === "inferred" ? (
    <span
      className="ml-1 rounded border border-outline-variant px-1 text-[10px] font-semibold text-outline"
      title="Not said outright; this follows from what was said"
    >
      inferred
    </span>
  ) : null

interface SectionProps {
  icon: React.ReactNode
  title: string
  copyText?: string
  copyLabel?: string
  isEmpty: boolean
  emptyText: string
  children: React.ReactNode
}

const Section: React.FC<SectionProps> = ({ icon, title, copyText, copyLabel, isEmpty, emptyText, children }) => (
  <section className="flex flex-col gap-2 rounded-2xl border border-outline-variant bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-sm font-bold text-on-surface">
        <span className="text-primary" aria-hidden="true">
          {icon}
        </span>
        {title}
      </h2>
      {/* A copy action appears only where there is something to copy */}
      {!isEmpty && copyText && <CopyButton text={copyText} label={copyLabel ?? `Copy ${title.toLowerCase()}`} showLabel />}
    </div>
    {isEmpty ? <p className="text-[13px] text-outline">{emptyText}</p> : children}
  </section>
)

const TaskList: React.FC<{ items: ActionItem[] }> = ({ items }) => (
  <ul className="space-y-1.5">
    {items.map((item, index) => (
      <li key={`${item.task}-${index}`} className="flex gap-2 text-[13px] leading-relaxed text-on-surface">
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden="true" />
        <span className="min-w-0 break-words">
          {item.task}
          {(item.owner || item.deadline) && (
            <span className="ml-1 text-[11px] text-outline">
              {item.owner ? item.owner : "owner not said"}
              {item.deadline ? ` · ${item.deadline}` : ""}
            </span>
          )}
          <Inferred evidence={item.evidence} />
        </span>
      </li>
    ))}
  </ul>
)

const DecisionList: React.FC<{ decisions: MeetingDecision[] }> = ({ decisions }) => (
  <ul className="space-y-1.5">
    {decisions.map((entry, index) => (
      <li key={`${entry.decision}-${index}`} className="flex gap-2 text-[13px] leading-relaxed text-on-surface">
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden="true" />
        <span className="min-w-0 break-words">
          {entry.decision}
          <Inferred evidence={entry.evidence} />
        </span>
      </li>
    ))}
  </ul>
)

/**
 * Everything the analysis found, in the order it is useful: the minutes to send, then what the
 * user himself owes, then the meeting as a whole. Each section copies its own content, and
 * anything the transcript did not settle is said plainly rather than filled in.
 */
export const MeetingAnalysisView: React.FC<MeetingAnalysisViewProps> = ({ analysis }) => (
  <div className="flex flex-col gap-3">
    <Section
      icon={<MessageSquareQuote size={16} />}
      title="Minutes of meeting"
      copyText={analysis.minutes}
      copyLabel="Copy the minutes to send the client"
      isEmpty={!analysis.minutes}
      emptyText="No summary was produced."
    >
      <p className="whitespace-pre-wrap break-words rounded-xl border-l-2 border-primary bg-surface-container-lowest px-4 py-3 text-[14px] leading-relaxed text-on-surface">
        {analysis.minutes}
      </p>
    </Section>

    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Section
        icon={<UserCheck size={16} />}
        title="My tasks"
        copyText={taskLines(analysis.myTasks)}
        copyLabel="Copy my tasks"
        isEmpty={analysis.myTasks.length === 0}
        emptyText="Nothing in this meeting was assigned to you."
      >
        <TaskList items={analysis.myTasks} />
      </Section>

      <Section
        icon={<MessageSquareQuote size={16} />}
        title="What the client asked for"
        copyText={plainLines(analysis.clientRequests)}
        copyLabel="Copy the client requests"
        isEmpty={analysis.clientRequests.length === 0}
        emptyText="The client asked for nothing specific in this meeting."
      >
        <ul className="space-y-1.5">
          {analysis.clientRequests.map((request, index) => (
            <li key={`${request}-${index}`} className="flex gap-2 text-[13px] leading-relaxed text-on-surface">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden="true" />
              <span className="min-w-0 break-words">{request}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        icon={<Gavel size={16} />}
        title="Decisions involving me"
        copyText={decisionLines(analysis.myDecisions)}
        copyLabel="Copy the decisions involving me"
        isEmpty={analysis.myDecisions.length === 0}
        emptyText="No decision in this meeting changes your work."
      >
        <DecisionList decisions={analysis.myDecisions} />
      </Section>

      <Section
        icon={<Users size={16} />}
        title={`Participants (${analysis.participantCount})`}
        copyText={analysis.participants.map((person) => `- ${person.name}${person.role ? ` (${person.role})` : ""}`).join("\n")}
        copyLabel="Copy the participants"
        isEmpty={analysis.participants.length === 0}
        emptyText="The transcript does not show who took part."
      >
        <ul className="flex flex-wrap gap-1.5">
          {analysis.participants.map((person, index) => (
            <li
              key={`${person.name}-${index}`}
              className={`rounded-lg border px-2 py-1 text-[12px] ${
                person.isNamed ? "border-outline-variant bg-surface-container-lowest text-on-surface" : "border-dashed border-outline-variant text-outline"
              }`}
              title={person.isNamed ? undefined : "This speaker is never named in the transcript"}
            >
              {person.name}
              {person.role && <span className="ml-1 text-outline">· {person.role}</span>}
            </li>
          ))}
        </ul>
      </Section>
    </div>

    <Section
      icon={<Target size={16} />}
      title="Purpose and topics"
      copyText={[analysis.purpose, plainLines(analysis.topics)].filter(Boolean).join("\n\n")}
      copyLabel="Copy the purpose and topics"
      isEmpty={!analysis.purpose && analysis.topics.length === 0}
      emptyText="The transcript never says why the meeting was held."
    >
      {analysis.purpose && <p className="text-[13px] leading-relaxed text-on-surface">{analysis.purpose}</p>}
      {analysis.topics.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-1.5">
          {analysis.topics.map((topic, index) => (
            <li key={`${topic}-${index}`} className="rounded-lg bg-surface-container px-2 py-1 text-[12px] text-on-surface-variant">
              {topic}
            </li>
          ))}
        </ul>
      )}
    </Section>

    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Section
        icon={<Gavel size={16} />}
        title="Decisions"
        copyText={decisionLines(analysis.decisions)}
        copyLabel="Copy the decisions"
        isEmpty={analysis.decisions.length === 0}
        emptyText="Nothing was settled in this meeting."
      >
        <DecisionList decisions={analysis.decisions} />
      </Section>

      <Section
        icon={<ClipboardList size={16} />}
        title="Action items"
        copyText={taskLines(analysis.actionItems)}
        copyLabel="Copy the action items"
        isEmpty={analysis.actionItems.length === 0}
        emptyText="No tasks were agreed in this meeting."
      >
        <TaskList items={analysis.actionItems} />
      </Section>
    </div>

    {analysis.unknowns.length > 0 && (
      <Section
        icon={<HelpCircle size={16} />}
        title="Left open"
        copyText={plainLines(analysis.unknowns)}
        copyLabel="Copy what was left open"
        isEmpty={false}
        emptyText=""
      >
        <ul className="space-y-1.5">
          {analysis.unknowns.map((unknown, index) => (
            <li key={`${unknown}-${index}`} className="flex gap-2 text-[13px] leading-relaxed text-on-surface-variant">
              <CheckSquare size={13} className="mt-1 shrink-0 text-outline" aria-hidden="true" />
              <span className="min-w-0 break-words">{unknown}</span>
            </li>
          ))}
        </ul>
      </Section>
    )}
  </div>
)
