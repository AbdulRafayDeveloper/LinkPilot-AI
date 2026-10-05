import { UsersRound, type LucideIcon } from "lucide-react"
import { NAME_MAX_LENGTH } from "./auth"

/**
 * Child accounts. A primary account makes accounts for other people that work **inside its own
 * workspace**: they read and write the same prompts, the same Workspace, the same LinkedIn Tools and
 * the same Client Work, because a child's records are scoped by its parent's id
 * (`dataOwnerId`, services/auth/accountViewer.ts). What each child may open is the parent's to
 * choose, one tool at a time, and a child can never hold a tool the parent does not have.
 *
 * A child is always a `user`, never an admin, and **cannot have children of its own**, which is why
 * this tool is `primaryOnly`: a child never sees it, it is never granted, and it cannot be turned off.
 */

export const CHILDREN_HREF = "/child-accounts"
export const CHILDREN_ENDPOINT = "/api/children"

// A parent keeps a team, not a user base; enough for a real one and small enough to stay a page
export const MAX_CHILDREN = 25

export const CHILD_ACCOUNTS_TOOL: {
  id: string
  title: string
  description: string
  icon: LucideIcon
  href: string
  group: "workspace"
  primaryOnly: true
} = {
  id: "child-accounts",
  title: "Child Accounts",
  description: "Accounts that share your workspace",
  icon: UsersRound,
  href: CHILDREN_HREF,
  group: "workspace",
  primaryOnly: true,
}

export const CHILDREN_MESSAGES = {
  loadFailed: "Couldn't load your child accounts. Please try again.",
  createFailed: "Couldn't create that account. Please try again.",
  saveFailed: "Couldn't save what this account can use. Please try again.",
  deleteFailed: "Couldn't delete that account. Please try again.",
  passwordFailed: "Couldn't change that password. Please try again.",
  notFound: "That account no longer exists.",
  // A child has no workspace of its own, so it has nobody to make accounts for
  childrenCannotNest: "A child account can't create child accounts.",
  tooMany: `You can have up to ${MAX_CHILDREN} child accounts.`,
  nameTooLong: `Keep the name under ${NAME_MAX_LENGTH} characters.`,
  unknownTool: "That isn't one of the tools that can be granted.",
  // Said on the page, because it is the whole point of a child account and not obvious
  sharesWorkspace:
    "A child account signs in with its own email and password and works inside your workspace: the same prompts, and the same records in every tool you give it. Anything it saves is yours too. It can never see a tool you have not given it, and it can never create accounts of its own.",
  noneYet: "No child accounts yet. Create one to let someone work in your workspace.",
  created: "Account created. Give it the tools it needs below.",
  deleted: "Account deleted. Everything it saved stays in your workspace.",
  passwordChanged: "Password changed. That account has been signed out everywhere.",
  // What deleting a child does and does not take with it, said before it is confirmed
  deleteExplains:
    "This signs the account out everywhere and removes it. Everything it saved stays in your workspace, because it was always yours.",
} as const
