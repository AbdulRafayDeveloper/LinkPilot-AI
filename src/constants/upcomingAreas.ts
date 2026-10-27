import { Megaphone, type LucideIcon } from "lucide-react"
import { FiverrIcon, HubstaffIcon, UpworkIcon } from "@/components/ui/BrandIcons"

/**
 * Areas of the app that are on their way: each has its own icon on the sidebar's rail, between the
 * working areas and Administration, at the owner's request, and choosing one says it is coming soon
 * and under development instead of listing tools. They hold no tools and lead to no page.
 *
 * **They are kept out of `TOOL_GROUPS` on purpose.** That list is what tools are filed under, and the
 * admin feature switches, the help page, the tool switcher and Dummy Data each walk it; an area with
 * nothing in it would be an empty heading in every one of them. When an area gets its first tool it
 * moves into `TOOL_GROUPS` and leaves this list, and the rail draws it as a working area from then on.
 */
export interface UpcomingArea {
  id: string
  label: string
  icon: LucideIcon
  // One short line under the heading, as a working area's `hint` is
  hint: string
}

export const UPCOMING_AREAS: readonly UpcomingArea[] = [
  { id: "upwork", label: "Upwork Tools", icon: UpworkIcon, hint: "Proposals and clients on Upwork" },
  { id: "fiverr", label: "Fiverr Tools", icon: FiverrIcon, hint: "Gigs and buyers on Fiverr" },
  { id: "hubstaff-talent", label: "Hubstaff Talent Tools", icon: HubstaffIcon, hint: "Your Hubstaff Talent profile" },
  { id: "ads", label: "Ads Tools", icon: Megaphone, hint: "Ads and campaigns" },
]

export const UPCOMING_MESSAGES = {
  comingSoon: "Coming soon",
  underDevelopment: "Under development",
  explain: (label: string) => `${label} are being built. They will appear here as soon as they are ready.`,
  railTitle: (label: string) => `${label}: coming soon`,
} as const
