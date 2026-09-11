"use client"

import React from "react"
import { Info } from "lucide-react"

/**
 * Tells the user the output says nothing about them because About Me is empty, with a
 * shortcut to fill it in.
 */
export const AboutMeNotice: React.FC<{ onOpenAboutMe: () => void; outputName: string }> = ({
  onOpenAboutMe,
  outputName,
}) => (
  <p className="flex items-start gap-2 bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-[12px] text-on-surface-variant">
    <Info size={14} className="shrink-0 mt-0.5 text-primary" aria-hidden="true" />
    <span>
      About Me isn&apos;t filled in, so this {outputName} says nothing about you. Add it under{" "}
      <button type="button" onClick={onOpenAboutMe} className="font-semibold text-primary hover:underline">
        Update Prompt → About Me
      </button>{" "}
      for pitches that describe what you do.
    </span>
  </p>
)

/**
 * Collapsible view of the profile detail and sender connection the model built on.
 */
export const AnalysisDetails: React.FC<{ keyDetail: string; senderLink: string | null }> = ({ keyDetail, senderLink }) => (
  <details className="group text-[12px] text-on-surface-variant">
    <summary className="cursor-pointer select-none font-semibold text-outline hover:text-primary list-none [&::-webkit-details-marker]:hidden">
      What it built on <span className="group-open:hidden">▸</span>
      <span className="hidden group-open:inline">▾</span>
    </summary>
    <dl className="mt-2 space-y-1.5 leading-relaxed">
      <div>
        <dt className="inline font-semibold text-on-surface">Profile detail: </dt>
        <dd className="inline">{keyDetail}</dd>
      </div>
      {senderLink && (
        <div>
          <dt className="inline font-semibold text-on-surface">Connection to you: </dt>
          <dd className="inline">{senderLink}</dd>
        </div>
      )}
    </dl>
  </details>
)
