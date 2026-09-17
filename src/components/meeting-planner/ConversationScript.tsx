"use client"

import React from "react"
import { CircleHelp, Clock, Ear, ExternalLink, ListChecks, MessageSquareQuote, MonitorPlay, StickyNote, type LucideIcon } from "lucide-react"
import { RichTextView } from "@/components/ui/RichTextView"
import { isSafeHref } from "@/lib/richText"
import type { ScriptStepKindId } from "@/constants/meetingPlanner"
import type { ScriptStage, ScriptStep } from "@/types/meetingPlanner"

export type ScriptTextSize = "regular" | "large" | "larger"

/**
 * How each kind of step looks, so the kind reads at a glance during a call: violet for words to
 * say, gold for a question, a strong grey band for the moment to stop and listen, a solid violet
 * card for a project to open, and a dashed note for a reminder.
 */
export const STEP_STYLE: Record<ScriptStepKindId, { icon: LucideIcon; label: string; badge: string; box: string }> = {
  say: {
    icon: MessageSquareQuote,
    label: "Say",
    badge: "bg-primary text-white",
    box: "border-primary/20 bg-primary/5",
  },
  ask: {
    icon: CircleHelp,
    label: "Ask",
    badge: "bg-secondary text-white",
    box: "border-secondary/30 bg-secondary-fixed/40",
  },
  listen: {
    icon: Ear,
    label: "Stop and listen",
    badge: "bg-tertiary text-white",
    box: "border-tertiary/30 bg-tertiary-fixed",
  },
  show_project: {
    icon: MonitorPlay,
    label: "Show project",
    badge: "bg-on-primary-fixed-variant text-white",
    box: "border-primary/40 bg-primary-fixed/60",
  },
  note: {
    icon: StickyNote,
    label: "Note",
    badge: "bg-outline text-white",
    box: "border-dashed border-outline-variant bg-surface-container-low",
  },
}

const TEXT_CLASS: Record<ScriptTextSize, string> = {
  regular: "text-[14px]",
  large: "text-[17px]",
  larger: "text-[20px]",
}
// The rich text viewer sets its own size and colour, so the script overrides them
const RICH_TEXT_CLASS: Record<ScriptTextSize, string> = {
  regular: "!gap-2 !text-[14px] !text-on-surface",
  large: "!gap-2 !text-[17px] !text-on-surface",
  larger: "!gap-2.5 !text-[20px] !text-on-surface",
}

const ScriptStepView: React.FC<{ step: ScriptStep; size: ScriptTextSize; link?: string }> = ({ step, size, link }) => {
  const style = STEP_STYLE[step.kind]
  const Icon = style.icon
  const isShow = step.kind === "show_project"
  return (
    <li className={`flex gap-3 rounded-xl border px-3 py-2.5 ${style.box}`}>
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${style.badge}`} aria-hidden="true">
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{style.label}</span>
          {isShow && step.project && <span className="text-[13px] font-bold text-on-surface">{step.project}</span>}
          {isShow && link && isSafeHref(link) && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-white hover:bg-on-primary-fixed-variant"
            >
              <ExternalLink size={11} aria-hidden="true" />
              Open project
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
          {isShow && step.minutes > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">
              <Clock size={11} aria-hidden="true" />
              about {step.minutes} min
            </span>
          )}
        </div>
        {step.text.trim() && (
          <div className={`mt-1 ${step.kind === "ask" ? "font-semibold" : ""}`}>
            <RichTextView text={step.text} className={RICH_TEXT_CLASS[size]} />
          </div>
        )}
        {isShow && step.features.length > 0 && (
          <div className="mt-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Show these features</p>
            <ul className={`mt-1 list-disc space-y-0.5 pl-5 leading-relaxed text-on-surface marker:text-primary ${TEXT_CLASS[size]}`}>
              {step.features.map((feature, index) => (
                <li key={`${index}-${feature}`}>{feature}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </li>
  )
}

/**
 * The conversation script, stage by stage, numbered in order. Read on the meeting page and in the
 * full view during the call, so every step says plainly what to do: say, ask, listen or show.
 */
export const ConversationScript: React.FC<{
  stages: ScriptStage[]
  size?: ScriptTextSize
  anchorPrefix?: string
  // Each project's link by its lowercased name, so a show step can open the project it names
  projectLinks?: Record<string, string>
}> = ({ stages, size = "regular", anchorPrefix = "stage", projectLinks = {} }) => (
  <ol className="space-y-4">
    {stages.map((stage, index) => (
      <li
        key={stage.id}
        id={`${anchorPrefix}-${stage.id}`}
        className="scroll-mt-24 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4"
      >
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-on-surface text-[13px] font-bold text-white tabular-nums">
            {index + 1}
          </span>
          <div className="min-w-0">
            <h3 className={`font-bold text-on-surface ${size === "regular" ? "text-[15px]" : size === "large" ? "text-[19px]" : "text-[22px]"}`}>
              {stage.title}
            </h3>
            {stage.goal && <p className="mt-0.5 text-[13px] leading-relaxed text-on-surface-variant">{stage.goal}</p>}
          </div>
        </div>
        {stage.steps.length > 0 && (
          <ol className="mt-3 space-y-2" aria-label={`Steps of ${stage.title}`}>
            {stage.steps.map((step) => (
              <ScriptStepView key={step.id} step={step} size={size} link={projectLinks[step.project.trim().toLowerCase()]} />
            ))}
          </ol>
        )}
        {stage.move_on_when && (
          <p className="mt-3 flex items-start gap-1.5 text-[13px] leading-relaxed text-on-surface-variant">
            <ListChecks size={14} className="mt-0.5 shrink-0 text-outline" aria-hidden="true" />
            <span>
              <span className="font-semibold text-on-surface">Move on when </span>
              {stage.move_on_when}
            </span>
          </p>
        )}
      </li>
    ))}
  </ol>
)
