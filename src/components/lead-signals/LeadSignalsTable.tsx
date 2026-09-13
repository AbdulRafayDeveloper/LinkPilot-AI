"use client"

import React from "react"
import { Gauge } from "lucide-react"
import { ScoreMeter } from "@/components/ui/ScoreMeter"
import { getScoreBand } from "@/constants/scoreBands"
import { EMPTY_SIGNAL_VALUES, type LeadTemperature } from "@/constants/leadSignals"
import type { LeadScore, LeadSignals } from "@/types/leadSignals"

type SignalRow =
  | { kind: "score"; label: string; value: (signals: LeadSignals) => LeadScore }
  | { kind: "tag"; label: string; value: (signals: LeadSignals) => string }
  | { kind: "text"; label: string; value: (signals: LeadSignals) => string }

// In the owner's chosen order
const SIGNAL_ROWS: SignalRow[] = [
  { kind: "score", label: "Meeting Chance", value: (signals) => signals.meetingChance },
  { kind: "score", label: "Relationship Strength", value: (signals) => signals.relationshipStrength },
  { kind: "score", label: "Client Potential", value: (signals) => signals.clientPotential },
  { kind: "score", label: "Buying Intent", value: (signals) => signals.buyingIntent },
  { kind: "text", label: "Industry", value: (signals) => signals.industry },
  { kind: "text", label: "Next Step", value: (signals) => signals.nextStep },
  { kind: "tag", label: "Country", value: (signals) => signals.country },
  { kind: "tag", label: "Technical Level", value: (signals) => signals.technicalLevel },
  { kind: "tag", label: "Seniority", value: (signals) => signals.seniority },
  { kind: "tag", label: "Lead Temperature", value: (signals) => signals.leadTemperature },
  { kind: "tag", label: "Decision Role", value: (signals) => signals.decisionRole },
  { kind: "tag", label: "Urgency", value: (signals) => signals.urgency },
  { kind: "tag", label: "Budget Signal", value: (signals) => signals.budgetSignal },
  { kind: "tag", label: "Company Size", value: (signals) => signals.companySize },
  { kind: "text", label: "Main Need", value: (signals) => signals.mainNeed },
  { kind: "text", label: "Main Objection", value: (signals) => signals.mainObjection },
]

const TEMPERATURE_STYLES: Record<LeadTemperature, string> = {
  Hot: "bg-secondary-container text-on-secondary-container",
  Warm: "bg-secondary-fixed text-on-secondary-fixed-variant",
  Cold: "bg-surface-container-high text-on-surface-variant",
}

const labelCell = "py-2.5 pr-3 text-[12px] font-semibold text-on-surface-variant whitespace-nowrap align-middle"

function isEmptyValue(value: string): boolean {
  return EMPTY_SIGNAL_VALUES.includes(value)
}

function tagStyle(value: string): string {
  if (isEmptyValue(value)) return "bg-surface-container text-outline"
  return TEMPERATURE_STYLES[value as LeadTemperature] ?? "bg-primary-fixed text-on-primary-fixed-variant"
}

const ScoreValue: React.FC<{ label: string; entry: LeadScore }> = ({ label, entry }) => (
  <div className="flex items-center gap-2 min-w-0">
    <span className="w-10 shrink-0 text-right text-sm font-bold text-on-surface">{entry.score}%</span>
    <ScoreMeter label={label} score={entry.score} className="flex-1 min-w-[48px] max-w-[140px]" />
    <span className="shrink-0 text-[11px] font-semibold text-outline">{getScoreBand(entry.score).label}</span>
    <span className="sr-only">{entry.reason}</span>
  </div>
)

const TagValue: React.FC<{ value: string }> = ({ value }) => (
  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${tagStyle(value)}`}>{value}</span>
)

const TextValue: React.FC<{ value: string }> = ({ value }) => (
  <span
    className={`block text-[13px] leading-snug line-clamp-2 ${isEmptyValue(value) ? "text-outline" : "text-on-surface"}`}
    title={value}
  >
    {value}
  </span>
)

function renderValue(row: SignalRow, signals: LeadSignals): React.ReactNode {
  if (row.kind === "score") return <ScoreValue label={row.label} entry={row.value(signals)} />
  if (row.kind === "tag") return <TagValue value={row.value(signals)} />
  return <TextValue value={row.value(signals)} />
}

const LoadingRows = () => (
  <tbody className="divide-y divide-outline-variant/60 animate-pulse" aria-hidden="true">
    {SIGNAL_ROWS.map((row) => (
      <tr key={row.label}>
        <th scope="row" className={labelCell}>
          {row.label}
        </th>
        <td className="py-2.5">
          <div className="h-3 w-3/4 rounded bg-surface-container-high" />
        </td>
      </tr>
    ))}
  </tbody>
)

interface LeadSignalsTableProps {
  signals: LeadSignals | null
  isLoading: boolean
}

/**
 * The lead signals as a compact table. Scores are estimates; hovering a score row shows
 * its one-line reason.
 */
export const LeadSignalsTable: React.FC<LeadSignalsTableProps> = ({ signals, isLoading }) => {
  const titleId = React.useId()

  return (
    <section
      aria-labelledby={titleId}
      aria-busy={isLoading}
      className="bg-white border border-outline-variant rounded-2xl shadow-sm p-5 flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={titleId} className="text-sm font-bold text-on-surface flex items-center gap-2">
          <Gauge size={16} className="text-primary" aria-hidden="true" />
          Lead Signals
        </h2>
        <p className="text-[11px] text-outline">Estimates · hover a score for the reason</p>
      </div>

      {!isLoading && !signals ? (
        <p className="text-[13px] text-on-surface-variant py-2">
          The lead signals couldn&apos;t be estimated this time. Generate again to retry.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <caption className="sr-only">Lead signals for this conversation</caption>
            {isLoading || !signals ? (
              <LoadingRows />
            ) : (
              <tbody className="divide-y divide-outline-variant/60">
                {SIGNAL_ROWS.map((row) => (
                  <tr key={row.label} title={row.kind === "score" ? row.value(signals).reason : undefined}>
                    <th scope="row" className={labelCell}>
                      {row.label}
                    </th>
                    <td className="py-2.5 w-full">{renderValue(row, signals)}</td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
      )}
    </section>
  )
}
