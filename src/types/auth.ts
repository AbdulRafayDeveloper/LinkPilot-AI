import type { UserRole } from "@/constants/auth"

/** The signed-in account, as the server and the page both see it. Never carries the password hash. */
export interface Viewer {
  id: string
  email: string
  name: string
  role: UserRole
  // The tools this account may not use. Always empty for an admin, who keeps every tool
  disabledTools: string[]
}

export interface LoginInput {
  email: string
  password: string
}

export interface SignupInput extends LoginInput {
  name: string
}
