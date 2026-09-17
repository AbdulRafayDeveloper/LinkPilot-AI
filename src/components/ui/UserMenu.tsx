"use client"

import React, { useEffect, useId, useRef, useState } from "react"
import { ChevronDown, Loader2, LogOut, ShieldCheck } from "lucide-react"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { requestApi } from "@/lib/apiClient"
import { clearAllToolState } from "@/lib/toolStore"
import { AUTH_ENDPOINTS, LOGIN_PATH, ROLE_LABELS } from "@/constants/auth"

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?"

/**
 * The signed-in account in the header: initials, and a menu with the name, email, role and Sign
 * out. Signing out also clears the tools' saved drafts from this browser, so the next account
 * starts clean.
 */
export const UserMenu: React.FC = () => {
  const { status, user } = useCurrentUser()
  const [isOpen, setIsOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const closeOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false)
    }
    document.addEventListener("mousedown", closeOutside)
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.removeEventListener("mousedown", closeOutside)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [isOpen])

  if (status === "loading") {
    return <span className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-surface-container-high" aria-hidden="true" />
  }
  if (!user) return null

  const signOut = async () => {
    setIsSigningOut(true)
    try {
      await requestApi(AUTH_ENDPOINTS.logout, { method: "POST" })
    } finally {
      clearAllToolState()
      window.location.assign(LOGIN_PATH)
    }
  }

  const isAdmin = user.role === "admin"

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label={`Account: ${user.name}`}
        className="flex h-9 items-center gap-1 rounded-full py-0.5 pl-0.5 pr-1.5 transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold ${
            isAdmin ? "bg-primary text-white" : "bg-primary-fixed text-on-primary-fixed-variant"
          }`}
        >
          {initialsOf(user.name)}
        </span>
        <ChevronDown size={14} className={`hidden text-outline transition-transform sm:block ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          id={menuId}
          className="absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-xl"
        >
          <div className="border-b border-outline-variant/70 px-4 py-3">
            <p className="truncate text-[14px] font-semibold text-on-surface">{user.name}</p>
            <p className="truncate text-[12px] text-on-surface-variant">{user.email}</p>
            <span
              className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                isAdmin ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant"
              }`}
            >
              {isAdmin && <ShieldCheck size={12} aria-hidden="true" />}
              {ROLE_LABELS[user.role]}
            </span>
            <p className="mt-2 text-[11px] leading-snug text-outline">
              {isAdmin ? "You see every account's records and the admin tools." : "You see the records you created."}
            </p>
          </div>
          <button
            type="button"
            onClick={signOut}
            disabled={isSigningOut}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] font-semibold text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-60"
          >
            {isSigningOut ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <LogOut size={15} aria-hidden="true" />}
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
