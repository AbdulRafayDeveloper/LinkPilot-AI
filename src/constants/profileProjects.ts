/**
 * My AI Profile (`/global-prompts`): what each person tells the system about themselves so every
 * tool can write as them. Two tabs: Profile Info (the profile prompt every tool quotes from) and
 * Projects (the work they can point to, one project at a time).
 *
 * **Projects are the interface only, for now**, at the owner's request ("for now just UI"): a
 * project is added, edited and removed on the page and kept in this browser (a tool store with
 * `remember`), and nothing reaches the server or any tool yet. The page says so, so nothing looks
 * saved to the account when it is not. The fields are the ones a real project write-up holds: a
 * name, the summary, what stands out, the Upwork jobs it proves, what to stress for a given client
 * need, and the words it should be found by.
 */

/**
 * The tabs in the order a profile is read: who you are and what you have done, then what you know
 * and offer, then what proves it. A tab with `comingSoon` is shown and can be opened, but holds only
 * a line saying what it will keep; it has no storage yet.
 */
export const MY_PROFILE_TABS = [
  { id: "profile", label: "Profile Info", hint: "Who you are, your experience and your skills. Every tool quotes from this and never invents beyond it." },
  { id: "experience", label: "Experience", hint: "The roles you have held: where, when and what you did there.", comingSoon: true },
  { id: "projects", label: "Projects", hint: "The work you can point to, so a tool can name the right project for each client." },
  { id: "skills", label: "Skills", hint: "What you are good at, so a tool only claims what you can really do.", comingSoon: true },
  { id: "services", label: "Services", hint: "What you offer clients, so a pitch names a service you really sell.", comingSoon: true },
  { id: "education", label: "Education", hint: "Where you studied and what you studied there.", comingSoon: true },
  { id: "certifications", label: "Certifications", hint: "The certificates you hold, with who issued them and when.", comingSoon: true },
  { id: "reviews", label: "Reviews", hint: "What clients have said about your work, to quote word for word.", comingSoon: true },
] as const
export type MyProfileTab = (typeof MY_PROFILE_TABS)[number]["id"]
export const DEFAULT_MY_PROFILE_TAB: MyProfileTab = "profile"
export const isMyProfileTab = (value: string | null): value is MyProfileTab => MY_PROFILE_TABS.some((tab) => tab.id === value)

export const PROJECT_LIMITS = {
  name: 120,
  summary: 3000,
  // One line of a list (a highlight, a job type, a keyword)
  line: 300,
  lines: 30,
  // One side of a "client needs → emphasize" pair
  match: 500,
  matches: 15,
  keywords: 40,
  projects: 100,
} as const

/**
 * Every field the Add project form asks for, with its label and the hint under it. The examples
 * come from a real project write-up, so the form reads in the words that write-up uses.
 */
export const PROJECT_FIELDS = {
  name: { label: "Project name", hint: "What you call it, e.g. Agency portfolio platform", placeholder: "Agency portfolio platform" },
  summary: {
    label: "Project summary",
    hint: "What it is and what it does, in a few sentences.",
    placeholder: "A professional corporate portfolio platform showcasing full-stack development services, case studies and testimonials...",
  },
  highlights: {
    label: "What stands out",
    hint: "One point per line: what makes this project worth showing.",
    placeholder: "Comprehensive service ecosystem covering full-stack, API and DevOps\nStrong emphasis on scalability and modern technology",
  },
  bestMatches: {
    label: "Strongest Upwork matches",
    hint: "One kind of job per line that this project proves you can do.",
    placeholder: "Custom web application development\nSaaS platform development\nMVP development",
  },
  proposalMatches: {
    label: "Feature-level proposal matching",
    hint: "When a client needs something, what of this project to emphasize.",
    need: "If the client needs...",
    emphasize: "Emphasize...",
    needPlaceholder: "a service portfolio website",
    emphasizePlaceholder: "the professional platform architecture and testimonial integration",
  },
  keywords: {
    label: "Search keywords",
    hint: "Words this project should be found by. Press Enter or type a comma after each.",
    placeholder: "SaaS marketing, lead generation, case studies",
  },
} as const

export const PROFILE_PROJECT_MESSAGES = {
  notSavedYet:
    "Projects are kept in this browser for now. Saving them to your account, and using them in the tools, comes next, so nothing here reaches a tool yet.",
  add: "Add project",
  edit: "Edit project",
  save: "Save project",
  cancel: "Cancel",
  remove: "Remove",
  removeConfirm: "Remove this project?",
  empty: "No projects yet. Add the work you want the tools to be able to point to.",
  needsName: "Give the project a name.",
  needsSummary: "Write a short summary of the project.",
  addMatch: "Add a match",
  tooMany: `You can keep up to ${PROJECT_LIMITS.projects} projects.`,
} as const
