import type { UserRole } from "@/constants/auth"
import type { LoginEventType } from "@/constants/admin"

export interface DeviceSummary {
  browser: string
  os: string
  device: string
}

/** One line of the audit log. */
export interface LoginEventEntry extends DeviceSummary {
  id: string
  createdAt: string
  event: LoginEventType
  // Null when the email typed matched no account
  userId: string | null
  email: string
  name: string | null
  ipAddress: string | null
  // The admin who caused it, for an event like an account being deleted
  performedBy: string | null
}

export interface AuditSummary {
  signIns24h: number
  failed24h: number
  activeUsers7d: number
  totalEvents: number
}

export interface AuditPage {
  items: LoginEventEntry[]
  nextCursor: string | null
  total: number
  // Sent with the first batch only
  summary: AuditSummary | null
}

/** One account as User Management lists it. Never carries the password hash or session details. */
export interface AdminUser {
  id: string
  name: string
  email: string
  role: UserRole
  createdAt: string
  lastLoginAt: string | null
  loginCount: number
  failedLoginCount: number
  isLocked: boolean
  // Everything the account has made across the tools, and when it last made something
  recordCount: number
  lastActivityAt: string | null
  lastDevice: DeviceSummary | null
}

export interface UsersSummary {
  totalUsers: number
  admins: number
  users: number
  active7d: number
  new30d: number
}

export interface UsersPage {
  items: AdminUser[]
  nextCursor: string | null
  total: number
  summary: UsersSummary | null
}

export interface ToolUsage {
  title: string
  href: string
  count: number
  lastUsedAt: string | null
}

export interface UserActivity {
  user: AdminUser
  tools: ToolUsage[]
  recentLogins: LoginEventEntry[]
}

/** What deleting an account removed, for the message the admin sees afterwards. */
export interface AccountDeletion {
  name: string
  email: string
  records: number
  files: number
  // Records removed per tool, busiest first, for the confirmation message
  tools: { title: string; count: number }[]
}
