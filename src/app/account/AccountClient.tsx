"use client"

import React, { useState, useSyncExternalStore } from "react"
import { Building2, Loader2, LogIn, Mail, ShieldCheck, SlidersHorizontal, UserCog, UserRound } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { AccountAvatar } from "@/components/ui/AccountAvatar"
import { PasswordSection } from "@/components/account/PasswordSection"
import { ProfileSection } from "@/components/account/ProfileSection"
import { TimeZoneSection } from "@/components/account/TimeZoneSection"
import { ColorSchemeSection } from "@/components/account/ColorSchemeSection"
import { SettingsCard, SettingsRow } from "@/components/account/SettingsCard"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { ACCOUNT_MESSAGES, ACCOUNT_TABS, type AccountTabId } from "@/constants/account"
import { ROLE_LABELS } from "@/constants/auth"

/**
 * Account Settings: the person's own profile, preferences and sign-in, in one page reached from the
 * account menu in the header, laid out the way a settings page usually is: the tabs down the left
 * (across the top on a phone) and one tab's cards beside them. Nothing here belongs to a tool, so no
 * switch can take it away and there is no feature guard on it: an account that could not change its
 * own password would have nowhere to go.
 */

const TAB_ICONS: Record<AccountTabId, React.ElementType> = { profile: UserRound, preferences: SlidersHorizontal, security: ShieldCheck }

// The open tab lives in the address, so a tab can be linked to and a reload stays on it
const tabFromHash = (): AccountTabId => {
  const asked = /(?:^|[#&])tab=([a-z]+)/.exec(window.location.hash)?.[1]
  return ACCOUNT_TABS.find((entry) => entry.id === asked)?.id ?? "profile"
}
const subscribeToHash = (listener: () => void) => {
  window.addEventListener("hashchange", listener)
  return () => window.removeEventListener("hashchange", listener)
}
const openTab = (id: AccountTabId) => {
  window.location.hash = `tab=${id}`
}

export default function AccountClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const { status, user } = useCurrentUser()
  const tab = useSyncExternalStore(subscribeToHash, tabFromHash, (): AccountTabId => "profile")
  const isAdmin = user?.role === "admin"

  return (
    <div className="font-body-md text-body-md min-h-screen bg-background text-on-surface flex overflow-hidden h-screen">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        <Header onOpenSidebar={() => setIsSidebarOpen(true)} isSidebarCollapsed={isCollapsed} onToggleCollapse={toggleCollapsed} />

        <main className="flex-1 overflow-y-auto bg-background overflow-x-hidden">
          <div className="mx-auto flex max-w-[1080px] flex-col gap-6 p-4 md:p-6 lg:p-8">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-2xl font-bold text-on-surface">
                <UserCog size={24} className="text-primary shrink-0" aria-hidden="true" />
                {ACCOUNT_MESSAGES.title}
              </h1>
              <p className="mt-1 text-sm text-on-surface-variant">{ACCOUNT_MESSAGES.subtitle}</p>
            </div>

            {status === "loading" && (
              <p role="status" className="flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface-container-lowest px-5 py-8 text-[13px] text-on-surface-variant">
                <Loader2 size={16} className="animate-spin text-primary" aria-hidden="true" />
                Reading your account...
              </p>
            )}

            {status !== "loading" && !user && (
              <p className="rounded-2xl border border-outline-variant bg-surface-container-lowest px-5 py-8 text-[13px] text-on-surface-variant">{ACCOUNT_MESSAGES.gone}</p>
            )}

            {user && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
                {/* Who is signed in, then the tabs: down the left on a laptop, across the top on a phone */}
                <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-0 lg:self-start">
                  <div className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
                    <AccountAvatar name={user.name} photo={user.photo} size="md" isAdmin={isAdmin} />
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-bold text-on-surface">{user.name}</p>
                      <p className="truncate text-[12px] text-on-surface-variant">{user.email}</p>
                    </div>
                  </div>
                  <div
                    role="tablist"
                    aria-label="Settings"
                    // Two by two on a phone, where one row cut "Preferences" short; one row from sm, a column from lg
                    className="grid grid-cols-2 gap-1 rounded-2xl border border-outline-variant bg-surface-container-lowest p-1.5 shadow-sm sm:flex lg:flex-col"
                  >
                    {ACCOUNT_TABS.map((entry) => {
                      const Icon = TAB_ICONS[entry.id]
                      const isOpen = entry.id === tab
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          role="tab"
                          id={`account-tab-${entry.id}`}
                          aria-selected={isOpen}
                          aria-controls={`account-panel-${entry.id}`}
                          onClick={() => openTab(entry.id)}
                          className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-left transition-colors lg:flex-none lg:justify-start lg:gap-3 lg:px-3 ${
                            isOpen ? "bg-primary text-white shadow-sm" : "text-on-surface hover:bg-surface-container-high"
                          }`}
                        >
                          <Icon size={17} className={`shrink-0 ${isOpen ? "text-white" : "text-primary"}`} aria-hidden="true" />
                          <span className="min-w-0">
                            <span className="block truncate text-[14px] font-semibold">{entry.label}</span>
                            <span className={`hidden truncate text-[11px] lg:block ${isOpen ? "text-white/90" : "text-outline"}`}>{entry.hint}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </aside>

                <div role="tabpanel" id={`account-panel-${tab}`} aria-labelledby={`account-tab-${tab}`} className="flex min-w-0 flex-col gap-6">
                  {tab === "profile" && (
                    <>
                      <ProfileSection user={user} />
                      {/* What the account is, read only here: an email and a role are an admin's to change */}
                      <SettingsCard title={ACCOUNT_MESSAGES.detailsTitle} description={ACCOUNT_MESSAGES.detailsHint} icon={Mail}>
                        <dl className="divide-y divide-outline-variant/60">
                          <SettingsRow label="Email">
                            <span className="break-all font-semibold">{user.email}</span>
                          </SettingsRow>
                          <SettingsRow label="Role">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
                                isAdmin ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant"
                              }`}
                            >
                              {isAdmin && <ShieldCheck size={12} aria-hidden="true" />}
                              {ROLE_LABELS[user.role]}
                            </span>
                          </SettingsRow>
                          {user.parentId && (
                            <SettingsRow label="Workspace">
                              <span className="flex items-start gap-2 text-[13px] text-on-surface-variant">
                                <Building2 size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                                {ACCOUNT_MESSAGES.childWorkspace}
                              </span>
                            </SettingsRow>
                          )}
                        </dl>
                      </SettingsCard>
                    </>
                  )}

                  {tab === "preferences" && (
                    <>
                      <ColorSchemeSection user={user} />
                      <TimeZoneSection user={user} />
                    </>
                  )}

                  {tab === "security" && (
                    <>
                      <PasswordSection />
                      <SettingsCard title={ACCOUNT_MESSAGES.signInTitle} description={ACCOUNT_MESSAGES.signInHint} icon={LogIn}>
                        <p className="text-[13px] leading-relaxed text-on-surface-variant">{ACCOUNT_MESSAGES.staysSignedIn}</p>
                      </SettingsCard>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
