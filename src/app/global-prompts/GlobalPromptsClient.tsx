"use client"

import React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { FolderKanban, UserRound, type LucideIcon } from "lucide-react"
import { GlobalPromptsPage, PromptCards } from "@/components/global-prompts/GlobalPromptsPage"
import { ProjectsTab } from "@/components/my-profile/ProjectsTab"
import { GLOBAL_PROMPTS_ENDPOINT, GLOBAL_PROMPTS_LINK, SHARED_GLOBAL_PROMPTS } from "@/constants/globalPrompts"
import { DEFAULT_MY_PROFILE_TAB, isMyProfileTab, MY_PROFILE_TABS, type MyProfileTab } from "@/constants/profileProjects"

const TAB_ICONS: Record<MyProfileTab, LucideIcon> = { profile: UserRound, projects: FolderKanban }

/**
 * My AI Profile: what a person tells the system about themselves so every tool writes as them, as
 * two tabs. Profile Info is the profile prompt the tools quote from; Projects is the work they can
 * point to. The open tab is in the address (`?tab=`), so a reload or a link opens the same one.
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
        <div role="tablist" aria-label={GLOBAL_PROMPTS_LINK.title} className="flex gap-1 rounded-2xl border border-outline-variant bg-white p-1 sm:w-fit">
          {MY_PROFILE_TABS.map((entry) => {
            const Icon = TAB_ICONS[entry.id]
            const isChosen = entry.id === tab
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                id={`profile-tab-${entry.id}`}
                aria-selected={isChosen}
                aria-controls={`profile-panel-${entry.id}`}
                onClick={() => choose(entry.id)}
                className={`inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 py-2.5 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  isChosen ? "bg-primary text-white" : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                {entry.label}
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
        ) : (
          <ProjectsTab />
        )}
      </div>
    </GlobalPromptsPage>
  )
}
