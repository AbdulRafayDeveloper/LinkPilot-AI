"use client"

import React, { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, CalendarDays, ExternalLink } from "lucide-react"
import { normalizeProfileUrl, profileHandle, profilePostsUrl } from "@/lib/linkedinProfile"
import { DAY_PARAM, PROFILE_PARAM, PROFILE_SCHEDULER_HREF, WEEK_DAYS } from "@/constants/profileScheduler"

const bannerButton =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"

/**
 * Shown on Comment Writer when a profile is opened from Profile Scheduler (`?profile=` and, when a
 * day was chosen there, `?day=`): whose posts are being commented on, a link to those posts on
 * LinkedIn, and the way back. Without the parameter, or with one that isn't a LinkedIn profile, it
 * shows nothing, so the page is exactly what it always was. The link is read through the same check
 * the scheduler saves with, so nothing else from the address can become a link here.
 */
function Banner() {
  const params = useSearchParams()
  const profileUrl = normalizeProfileUrl(params.get(PROFILE_PARAM) ?? "")
  if (!profileUrl) return null
  const day = WEEK_DAYS.find((entry) => entry.id === params.get(DAY_PARAM))

  return (
    <section
      aria-label="Profile opened from Profile Scheduler"
      className="flex shrink-0 flex-col gap-2 rounded-2xl border border-primary/30 bg-primary-fixed/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="min-w-0 text-[13px] text-on-surface">
        <span className="break-all font-semibold">Commenting on {profileHandle(profileUrl)}</span>
        {day && (
          <span className="ml-2 inline-flex items-center gap-1 text-on-surface-variant">
            <CalendarDays size={13} aria-hidden="true" />
            {day.label}
          </span>
        )}
        <span className="block text-[12px] text-on-surface-variant">Open their posts, paste the one to answer below, and write the comment.</span>
      </p>
      <div className="flex flex-wrap gap-2 sm:shrink-0">
        <a href={profilePostsUrl(profileUrl)} target="_blank" rel="noopener noreferrer" className={`${bannerButton} bg-primary text-white hover:bg-on-primary-fixed-variant`}>
          <ExternalLink size={14} aria-hidden="true" />
          Open their posts
          <span className="sr-only">(opens LinkedIn in a new tab)</span>
        </a>
        <Link href={PROFILE_SCHEDULER_HREF} className={`${bannerButton} border border-outline-variant bg-white text-on-surface hover:bg-surface-container-high`}>
          <ArrowLeft size={14} aria-hidden="true" />
          Profile Scheduler
        </Link>
      </div>
    </section>
  )
}

// Reading the address needs a Suspense boundary, and there is nothing to show while it waits
export const ProfilePostsBanner: React.FC = () => (
  <Suspense fallback={null}>
    <Banner />
  </Suspense>
)
