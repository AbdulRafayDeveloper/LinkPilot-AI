import React from "react"
import Image from "next/image"
import Link from "next/link"
import { SITE_LOGO_PNG, SITE_NAME, SITE_SHORT_NAME } from "@/config/site"
import { LINKEDIN_TOOLS } from "@/constants/linkedinTools"

// "/" only redirects to the first tool, so home links go straight there
export const HOME_HREF = LINKEDIN_TOOLS[0].href

interface BrandLogoProps {
  // Extra classes for the name and AI badge, e.g. to hide them in the collapsed sidebar
  wordmarkClassName?: string
  className?: string
  priority?: boolean
}

/**
 * The one brand lockup used everywhere: the mark, "LinkPilot" and the AI badge, linking home.
 * The 512px mark keeps it sharp on high-density screens at every size it's shown.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({ wordmarkClassName = "", className = "", priority = false }) => (
  <Link
    href={HOME_HREF}
    aria-label={`${SITE_NAME} home`}
    className={`flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${className}`}
  >
    <Image alt="" className="h-9 w-9 shrink-0" src={SITE_LOGO_PNG} width={36} height={36} priority={priority} />
    <span className={`flex items-center gap-1.5 ${wordmarkClassName}`}>
      <span className="text-[16px] font-bold tracking-tight text-on-surface">{SITE_SHORT_NAME}</span>
      <span className="rounded-md bg-primary-fixed px-1.5 py-0.5 text-[10px] font-bold leading-none text-on-primary-fixed-variant">
        AI
      </span>
    </span>
  </Link>
)
