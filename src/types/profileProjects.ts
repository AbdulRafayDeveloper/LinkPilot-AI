/** A project on My AI Profile → Projects. See constants/profileProjects.ts. */

/** "If the client needs X, emphasize Y": what of this project to stress for one kind of client. */
export interface ProposalMatch {
  need: string
  emphasize: string
}

export interface ProfileProject {
  id: string
  name: string
  summary: string
  // What makes the project worth showing, one point each
  highlights: string[]
  // The kinds of Upwork job it proves, one each
  bestMatches: string[]
  proposalMatches: ProposalMatch[]
  keywords: string[]
  createdAt: string
  updatedAt: string
}

/** What the Add project form holds while it is being written: lists as the text typed. */
export interface ProjectDraft {
  name: string
  summary: string
  highlights: string
  bestMatches: string
  proposalMatches: ProposalMatch[]
  keywords: string[]
}
