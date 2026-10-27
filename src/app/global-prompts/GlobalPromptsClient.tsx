"use client"

import React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Award, BriefcaseBusiness, FolderKanban, GraduationCap, Handshake, Hourglass, MessageSquareQuote, Sparkles, UserRound, type LucideIcon } from "lucide-react"
import { GlobalPromptsPage, PromptCards } from "@/components/global-prompts/GlobalPromptsPage"
import { ProjectsTab } from "@/components/my-profile/ProjectsTab"
import { GLOBAL_PROMPTS_ENDPOINT, GLOBAL_PROMPTS_LINK, SHARED_GLOBAL_PROMPTS } from "@/constants/globalPrompts"
import { DEFAULT_MY_PROFILE_TAB, isMyProfileTab, MY_PROFILE_TABS, type MyProfileTab } from "@/constants/profileProjects"

const TAB_ICONS: Record<MyProfileTab, LucideIcon> = {
  profile: UserRound,
  experience: BriefcaseBusiness,
  projects: FolderKanban,
  skills: Sparkles,
  services: Handshake,
  education: GraduationCap,
  certifications: Award,
  reviews: MessageSquareQuote,
}

const COMING_SOON = "Coming soon"

/**
 * My AI Profile: what a person tells the system about themselves so every tool writes as them.
 * Profile Info is the profile prompt the tools quote from and Projects is the work they can point
 * to; the other tabs (Experience, Skills, Services, Education, Certifications, Reviews) open but
 * only say they are coming. The open tab is in the address (`?tab=`), so a reload or a link opens
 * the same one.
 */
export default function GlobalPromptsClient() {
  const router = useRouter()
  const asked = useSearchParams().get("tab")
  const tab: MyProfileTab = isMyProfileTab(asked) ? asked : DEFAULT_MY_PROFILE_TAB
  const current = MY_PROFILE_TABS.find((entry) => entry.id === tab) ?? MY_PROFILE_TABS[0]
  // Replaced rather than pushed, so Back still leaves the page
  const choose = (next: MyProfileTab) => router.replace(next === DEFAULT_MY_PROFILE_TAB ? "?" : `?tab=${next}`, { scroll: false })

  return (
    <GlobalPromptsPage
      heading={GLOBAL_PROMPTS_LINK.title}
      intro="Everything about you that the tools use to write as you: your profile, and the projects you can point to."
      icon={GLOBAL_PROMPTS_LINK.icon}
    >
      <div className="flex flex-col gap-2">
        {/* Eight tabs wrap onto a second row rather than running off a phone or a laptop's edge */}
        <div role="tablist" aria-label={GLOBAL_PROMPTS_LINK.title} className="flex flex-wrap gap-1 rounded-2xl border border-outline-variant bg-white p-1">
          {MY_PROFILE_TABS.map((entry) => {
            const Icon = TAB_ICONS[entry.id]
            const isChosen = entry.id === tab
            const isComing = "comingSoon" in entry
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                id={`profile-tab-${entry.id}`}
                aria-selected={isChosen}
                aria-controls={`profile-panel-${entry.id}`}
                onClick={() => choose(entry.id)}
                className={`inline-flex flex-auto items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:flex-none ${
                  isChosen ? "bg-primary text-white" : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                {entry.label}
                {isComing && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      isChosen ? "bg-white/20 text-white" : "bg-secondary-fixed text-on-secondary-fixed-variant"
                    }`}
                  >
                    Soon
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {/* What the open tab is for, in one line */}
        <p className="px-1 text-[13px] text-on-surface-variant">{current.hint}</p>
      </div>

      <div id={`profile-panel-${tab}`} role="tabpanel" aria-labelledby={`profile-tab-${tab}`} className="min-w-0">
        {tab === "profile" ? (
          <PromptCards
            note="Your profile is what the tools quote when they write about you, such as your experience, your projects and your numbers. It is shared by every account for now, so a change here changes it for everyone."
            prompts={SHARED_GLOBAL_PROMPTS}
            endpoint={GLOBAL_PROMPTS_ENDPOINT}
          />
        ) : tab === "projects" ? (
          <ProjectsTab />
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-outline-variant bg-white px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary-fixed text-on-secondary-fixed-variant">
              <Hourglass size={22} aria-hidden="true" />
            </span>
            <p className="text-[15px] font-bold text-on-surface">
              {current.label}: {COMING_SOON}
            </p>
            <p className="max-w-md text-[13px] leading-relaxed text-on-surface-variant">{current.hint}</p>
          </div>
        )}
      </div>
    </GlobalPromptsPage>
  )
}
