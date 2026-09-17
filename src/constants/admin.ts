import { ListOrdered, ScrollText, ShieldCheck, UsersRound, type LucideIcon } from "lucide-react"

/**
 * The admin area: Audit Management (every sign-in, sign-up, sign-out and refused attempt, newest
 * first), User Management (every account, its sign-ins and what it has made in each tool) and AI Model
 * Priority (the order each module tries the AI providers in, for admins; constants/modelPriority.ts).
 * Only an admin sees it in the sidebar, and every route and page behind it checks the role.
 */

export const AUDIT_HREF = "/admin/audit"
export const USERS_HREF = "/admin/users"
export const MODEL_PRIORITY_HREF = "/admin/models"
export const ADMIN_ENDPOINTS = {
  audit: "/api/admin/audit",
  users: "/api/admin/users",
} as const

export const LOGIN_EVENTS = [
  { id: "sign-in", label: "Signed in" },
  { id: "sign-up", label: "Signed up" },
  { id: "sign-out", label: "Signed out" },
  { id: "failed", label: "Wrong password" },
  { id: "locked", label: "Locked out" },
  // An admin deleted the account and everything it made; the event names the admin who did
  { id: "account-deleted", label: "Account deleted" },
] as const
export type LoginEventType = (typeof LOGIN_EVENTS)[number]["id"]
export const LOGIN_EVENT_IDS = LOGIN_EVENTS.map((event) => event.id) as [LoginEventType, ...LoginEventType[]]
export const loginEventLabel = (id: LoginEventType) => LOGIN_EVENTS.find((event) => event.id === id)?.label ?? id

// The most of a user agent kept on an event; enough to identify the browser, never a whole header dump
export const USER_AGENT_MAX_LENGTH = 400
// How many of an account's own sign-in events its detail view shows
export const RECENT_LOGINS_SHOWN = 20
// "Active" on the summaries means signed in within this many days
export const ACTIVE_DAYS = 7

export const ADMIN_MESSAGES = {
  auditLoadFailed: "Couldn't load the audit log. Please try again.",
  usersLoadFailed: "Couldn't load the accounts. Please try again.",
  userNotFound: "That account no longer exists.",
  cannotDeleteSelf: "You can't delete the account you are signed in with.",
  cannotDeleteLastAdmin: "This is the only admin account, so it can't be deleted.",
  confirmEmailMismatch: "Type the account's email address exactly to confirm.",
  storageUnavailable: "This account has stored files, but file storage isn't configured here, so they can't be removed. Nothing was deleted.",
  deleteFailed: "Couldn't delete the account. Nothing that was left has been lost, so please try again.",
} as const

export const ADMIN_TOOL: {
  id: string
  title: string
  description: string
  icon: LucideIcon
  href: string
  group: "workspace"
  adminOnly: true
  links: { title: string; description: string; icon: LucideIcon; href: string; pageTitle: string }[]
} = {
  id: "administration",
  title: "Administration",
  description: "Sign-ins, accounts, activity and AI models",
  icon: ShieldCheck,
  href: AUDIT_HREF,
  group: "workspace",
  adminOnly: true,
  links: [
    { title: "Audit Management", description: "Every sign-in, newest first", icon: ScrollText, href: AUDIT_HREF, pageTitle: "Audit Management" },
    { title: "User Management", description: "Every account and its activity", icon: UsersRound, href: USERS_HREF, pageTitle: "User Management" },
    { title: "AI Model Priority", description: "The order each module tries the AI models in", icon: ListOrdered, href: MODEL_PRIORITY_HREF, pageTitle: "AI Model Priority" },
  ],
}
