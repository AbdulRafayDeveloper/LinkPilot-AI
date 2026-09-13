"use client"

import React from "react"
import { getScoreBand } from "@/constants/scoreBands"

function barColor(score: number): string {
  if (score >= 61) return "bg-primary"
  if (score >= 41) return "bg-secondary-container"
  return "bg-error/70"
}

interface ScoreMeterProps {
  label: string
  score: number
  className?: string
}

/**
 * A 0–100 score as a thin colored bar, announced to screen readers with its band.
 */
export const ScoreMeter: React.FC<ScoreMeterProps> = ({ label, score, className = "" }) => (
  <div
    role="meter"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={score}
    aria-valuetext={`${score}%, ${getScoreBand(score).label}`}
    className={`h-1.5 rounded-full bg-surface-container overflow-hidden ${className}`}
  >
    <div className={`h-full rounded-full ${barColor(score)}`} style={{ width: `${score}%` }} />
  </div>
)
