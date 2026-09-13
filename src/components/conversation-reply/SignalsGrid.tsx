"use client"

import React from "react"
import { ScoreMeter } from "@/components/ui/ScoreMeter"
import type { RiskLevel } from "@/constants/conversationReply"
import { getScoreBand } from "@/constants/scoreBands"
import type { ConversationSignals, ScoreSignal, ScoreSignalKey } from "@/types/conversationReply"

type SignalTile =
  | { kind: "score"; key: ScoreSignalKey; label: string }
  | { kind: "clientSize"; label: string }
  | { kind: "risk"; label: string }

// Display order follows the spec: the ten core signals
const SIGNAL_TILES: SignalTile[] = [
  { kind: "score", key: "clientPotential", label: "Client Potential" },
  { kind: "score", key: "relationshipStrength", label: "Relationship Strength" },
  { kind: "score", key: "longTermPotential", label: "Long-Term Potential" },
  { kind: "clientSize", label: "Client Size" },
  { kind: "score", key: "buyingIntent", label: "Buying Intent" },
  { kind: "score", key: "conversationMomentum", label: "Conversation Momentum" },
  { kind: "score", key: "recipientInterest", label: "Recipient Interest" },
  { kind: "score", key: "decisionMakerLikelihood", label: "Decision-Maker Likelihood" },
  { kind: "score", key: "opportunityFit", label: "Opportunity Fit" },
  { kind: "risk", label: "Risk Level" },
]

const RISK_STYLES: Record<RiskLevel, string> = {
  Low: "bg-primary-fixed text-on-primary-fixed-variant",
  Medium: "bg-secondary-fixed text-on-secondary-fixed-variant",
  High: "bg-error-container text-on-error-container",
}

const TileShell: React.FC<{ label: string; value: React.ReactNode; summary: string; children?: React.ReactNode }> = ({
  label,
  value,
  summary,
  children,
}) => (
  <li className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3 min-w-0 flex flex-col">
    <div className="flex items-center justify-between gap-2 min-h-[22px]">
      <h4 className="text-[10px] font-bold text-outline uppercase tracking-wider leading-tight">{label}</h4>
      <div className="shrink-0 text-right">{value}</div>
    </div>
    {children}
    <p className="mt-1.5 text-[12px] leading-snug text-on-surface-variant line-clamp-3" title={summary}>
      {summary}
    </p>
  </li>
)

const ScoreTile: React.FC<{ label: string; signal: ScoreSignal }> = ({ label, signal }) => (
  <TileShell
    label={label}
    summary={signal.summary}
    value={<span className="text-base font-bold text-on-surface leading-none">{signal.score}%</span>}
  >
    <div className="mt-2 flex items-center gap-2">
      <ScoreMeter label={label} score={signal.score} className="flex-1" />
      <span className="shrink-0 text-[10px] font-semibold text-outline">{getScoreBand(signal.score).label}</span>
    </div>
  </TileShell>
)

const ValueChip: React.FC<{ className: string; children: React.ReactNode }> = ({ className, children }) => (
  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${className}`}>{children}</span>
)

/**
 * Compact grid of the ten conversation signals. Scores are evidence-based estimates, and
 * each tile carries a one-line explanation (full text on hover when clamped).
 */
export const SignalsGrid: React.FC<{ signals: ConversationSignals }> = ({ signals }) => (
  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
    {SIGNAL_TILES.map((tile) => {
      if (tile.kind === "score") {
        return <ScoreTile key={tile.key} label={tile.label} signal={signals[tile.key]} />
      }
      if (tile.kind === "clientSize") {
        return (
          <TileShell
            key="clientSize"
            label={tile.label}
            summary={signals.clientSize.summary}
            value={<ValueChip className="bg-surface-container text-on-surface">{signals.clientSize.value}</ValueChip>}
          />
        )
      }
      return (
        <TileShell
          key="riskLevel"
          label={tile.label}
          summary={signals.riskLevel.summary}
          value={<ValueChip className={RISK_STYLES[signals.riskLevel.value]}>{signals.riskLevel.value}</ValueChip>}
        />
      )
    })}
  </ul>
)
