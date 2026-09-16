"use client"

import React from "react"
import { CircleHelp, Compass, Handshake, ListChecks, ShieldAlert, Target, UserSearch } from "lucide-react"
import type { Evidence, LeadObservation, MeetingPrep } from "@/types/meetingPlanner"

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

const Section: React.FC<{ icon: React.ElementType; title: string; subtitle?: string; children: React.ReactNode }> = ({
  icon: Icon,
  title,
  subtitle,
  children,
}) => (
  <section className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h2 className="flex items-center gap-2 text-sm font-bold text-on-surface">
        <Icon size={16} className="text-primary" aria-hidden="true" />
        {title}
      </h2>
      {subtitle && <p className="text-[11px] text-outline">{subtitle}</p>}
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

/**
 * The saved preparation, laid out to be read a few minutes before the call and glanced at
 * during it: who they are, what to talk about, and the conversation stage by stage.
 */
export const MeetingPrepView: React.FC<{ prep: MeetingPrep }> = ({ prep }) => {
  const { lead_analysis: lead, discussion_topics: topics, conversation_plan: plan, deal_path: deal, cautions } = prep

  return (
    <div className="flex flex-col gap-5">
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

      {plan.length > 0 && (
        <Section icon={Compass} title="The conversation, start to finish" subtitle="A guide, not a script">
          <ol className="space-y-3">
            {plan.map((stage, index) => (
              <li key={stage.stage} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white tabular-nums">
                    {index + 1}
                  </span>
                  <h3 className="text-[13px] font-bold text-on-surface">{stage.stage}</h3>
                  <span className="text-[11px] text-outline">{stage.goal}</span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-on-surface">{stage.what_to_say}</p>
                {stage.questions.length > 0 && (
                  <div className="mt-2">
                    <Heading>Ask</Heading>
                    <ul className="mt-1 space-y-1 text-[13px] leading-relaxed text-on-surface">
                      {stage.questions.map((question) => (
                        <li key={question} className="border-l-2 border-primary/30 pl-2.5 italic">
                          {question}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {stage.transition && (
                  <p className="mt-2 text-[12px] leading-relaxed text-on-surface-variant">
                    <span className="font-semibold text-on-surface">Then: </span>
                    {stage.transition}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </Section>
      )}

      <Section icon={Handshake} title="Towards a project" subtitle="Only once the fit is clear">
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
    </div>
  )
}
