/** One child account, as its parent's page lists it. Never carries the password hash. */
export interface ChildAccount {
  id: string
  name: string
  email: string
  // The tools the parent has granted it, in the navigation's own order
  grantedTools: string[]
  // A granted tool the parent no longer has itself, so the child does not have it either
  withheldTools: string[]
  lastLoginAt: string | null
  loginCount: number
  createdAt: string
}

export interface ChildrenPage {
  items: ChildAccount[]
  // How many more this account may create
  remaining: number
  // The tools the parent can grant, which is what the parent itself may use
  grantableTools: string[]
}

export interface ChildInput {
  name: string
  email: string
  password: string
}
