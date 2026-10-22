"use client"

import React, { useState } from "react"
import { Loader2, Mail, ShieldCheck, UserCog } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { PasswordSection } from "@/components/account/PasswordSection"
import { ProfileSection } from "@/components/account/ProfileSection"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { ACCOUNT_MESSAGES } from "@/constants/account"
import { ROLE_LABELS } from "@/constants/auth"

/**
 * Account Settings: the person's own name, photo and password, in one page reached from the account
 * menu in the header. Nothing here belongs to a tool, so no switch can take it away and there is no
 * feature guard on it: an account that could not change its own password would have nowhere to go.
 */
export default function AccountClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const { status, user } = useCurrentUser()
  const isAdmin = user?.role === "admin"

  return (
    <div className="font-body-md text-body-md min-h-screen bg-background text-on-surface flex overflow-hidden h-screen">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        <Header onOpenSidebar={() => setIsSidebarOpen(true)} isSidebarCollapsed={isCollapsed} onToggleCollapse={toggleCollapsed} />

        <main className="flex-1 overflow-y-auto bg-background overflow-x-hidden">
          <div className="max-w-[900px] mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-5">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-2xl font-bold text-on-surface">
                <UserCog size={24} className="text-primary shrink-0" aria-hidden="true" />
                {ACCOUNT_MESSAGES.title}
              </h1>
              <p className="mt-1 text-sm text-on-surface-variant">{ACCOUNT_MESSAGES.subtitle}</p>
            </div>

            {status === "loading" && (
              <p className="flex items-center gap-2 rounded-2xl border border-outline-variant bg-white px-4 py-6 text-[13px] text-on-surface-variant">
                <Loader2 size={16} className="animate-spin text-primary" aria-hidden="true" />
                Reading your account...
              </p>
            )}

            {status !== "loading" && !user && (
              <p className="rounded-2xl border border-outline-variant bg-white px-4 py-6 text-[13px] text-on-surface-variant">
                {ACCOUNT_MESSAGES.gone}
              </p>
            )}

            {user && (
              <>
                {/* What the account is, which is read only here: an email and a role are an admin's to change */}
                <section className="rounded-2xl border border-outline-variant bg-surface-container-low p-4 sm:p-5 flex flex-col gap-2">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-outline">{ACCOUNT_MESSAGES.signedInTitle}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="flex items-center gap-2 text-[14px] font-semibold text-on-surface">
                      <Mail size={15} className="shrink-0 text-on-surface-variant" aria-hidden="true" />
                      {user.email}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        isAdmin ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant"
                      }`}
                    >
                      {isAdmin && <ShieldCheck size={12} aria-hidden="true" />}
                      {ROLE_LABELS[user.role]}
                    </span>
                  </div>
                  <p className="text-[12px] leading-relaxed text-on-surface-variant">{ACCOUNT_MESSAGES.staysSignedIn}</p>
                  {user.parentId && <p className="text-[12px] leading-relaxed text-on-surface-variant">{ACCOUNT_MESSAGES.childWorkspace}</p>}
                </section>

                <ProfileSection user={user} />
                <PasswordSection />
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
