"use client"

import React from "react"

const variableChip = "font-code text-on-surface-variant bg-surface-container px-1 rounded"

/**
 * Hint under a tool's Lead Signals prompt editor. Each tool saves its own copy of the prompt.
 */
export const LeadSignalsPromptHint: React.FC = () => (
  <p className="leading-relaxed">
    Decides the Lead Signals table shown with every result (meeting chance, relationship, client potential, buying intent,
    industry, next step, country, technical level, seniority, temperature, decision role, urgency, budget, company size,
    need and objection). Variables: <code className={variableChip}>{"{{conversation}}"}</code> ·{" "}
    <code className={variableChip}>{"{{profile_data}}"}</code> · <code className={variableChip}>{"{{sender_profile}}"}</code>{" "}
    (your About Me). This tool saves its own copy, so editing it never changes another tool&apos;s Lead Signals prompt. The
    app keeps the signals and their label options fixed, keeps scores at 0–100, answers Unknown instead of guessing, and
    never guesses a country from a name.
  </p>
)
