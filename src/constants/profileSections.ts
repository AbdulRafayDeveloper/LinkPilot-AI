/**
 * My AI Profile (`/global-prompts`): what each person tells the system about themselves, so a tool
 * can write as them. The first tab is Profile Info, the free text every tool quotes today
 * (services/profileInfo.ts); the other seven are **sections** of entries the person adds, edits and
 * removes, as many as they like: Experience, Projects, Skills, Services, Education, Certifications
 * and Reviews.
 *
 * **Everything about a section is declared here and nowhere else**: its fields, what each field is
 * (a line, a paragraph, a list, a date, a choice …), which field names an entry and which describe it.
 * The form, the cards, the server's validation (lib/profileSections.ts) and the text each entry is
 * embedded as are all built from this list, so a new field is one line here.
 *
 * Every entry, and Profile Info itself, is turned into vectors by Gemini and kept in MongoDB
 * (services/myProfile/vectors.ts), one person's apart from everyone's, so the tools can later pick the
 * parts of a person's profile that fit the job in hand. Nothing reads them in a tool yet.
 */

export type ProfileFieldKind =
  // One line
  | "text"
  // A paragraph or more
  | "longText"
  // A web address
  | "url"
  // A month, YYYY-MM
  | "month"
  // A whole number
  | "number"
  // One of a fixed list
  | "choice"
  // Yes or no
  | "toggle"
  // A list typed one item per line
  | "lines"
  // Short words or phrases, as chips
  | "chips"
  // "If the client needs X, emphasize Y" pairs
  | "pairs"

export interface ProfileField {
  key: string
  label: string
  kind: ProfileFieldKind
  hint?: string
  placeholder?: string
  required?: boolean
  // The longest one value may be (a list item for lists, either half for a pair)
  max?: number
  options?: readonly string[]
  // number only
  min?: number
  // number only
  upTo?: number
  // A field the form greys out while this toggle is on (an end date while "I work here now")
  clears?: string
  // The two halves of a pair, as the form asks for them
  pairLabels?: readonly [string, string]
  // Two short fields may share a row in the form
  half?: boolean
}

export interface ProfileSection {
  id: string
  label: string
  // One entry, in a sentence ("Add a role", "No roles yet")
  noun: string
  hint: string
  // The field an entry is named by on its card and in its embedded text
  titleField: string
  // Shown under the name, joined by " · "
  subtitleFields: readonly string[]
  // [start, end, still-going toggle], read as "Jan 2023 to Present"; a single date stands alone
  dates?: readonly [string, string?, string?]
  fields: readonly ProfileField[]
}

// How long a value may be, by what kind of value it is; a field may ask for less
export const FIELD_LIMITS = {
  text: 200,
  longText: 5000,
  url: 500,
  listItem: 300,
  listItems: 40,
  chip: 60,
  chips: 40,
  pair: 500,
  pairs: 20,
} as const

const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Freelance", "Internship", "Self-employed"] as const
const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"] as const
const REVIEW_PLATFORMS = ["Upwork", "Fiverr", "LinkedIn", "Clutch", "Google", "Direct", "Other"] as const
const RATINGS = ["5", "4", "3", "2", "1"] as const

export const PROFILE_SECTIONS: readonly ProfileSection[] = [
  {
    id: "experience",
    label: "Experience",
    noun: "role",
    hint: "The roles you have held: where, when and what you did there.",
    titleField: "role",
    subtitleFields: ["company", "employmentType", "location"],
    dates: ["startMonth", "endMonth", "isCurrent"],
    fields: [
      { key: "role", label: "Role", kind: "text", required: true, placeholder: "Full-Stack Developer", half: true },
      { key: "company", label: "Company", kind: "text", required: true, placeholder: "Acme Labs", half: true },
      { key: "employmentType", label: "Type", kind: "choice", options: EMPLOYMENT_TYPES, half: true },
      { key: "location", label: "Location", kind: "text", placeholder: "Lahore, Pakistan (remote)", half: true },
      { key: "startMonth", label: "Started", kind: "month", half: true },
      { key: "endMonth", label: "Ended", kind: "month", half: true },
      { key: "isCurrent", label: "I work here now", kind: "toggle", clears: "endMonth" },
      { key: "summary", label: "What you did", kind: "longText", hint: "Your work there, in a few sentences.", placeholder: "Built and ran the client dashboards..." },
      { key: "achievements", label: "Achievements", kind: "lines", hint: "One per line, with the numbers that prove them.", placeholder: "Cut page load time from 4s to 1.2s\nShipped 3 SaaS MVPs in 6 months" },
      { key: "technologies", label: "Technologies", kind: "chips", hint: "Press Enter or type a comma after each.", placeholder: "Next.js, Node.js, MongoDB" },
    ],
  },
  {
    id: "projects",
    label: "Projects",
    noun: "project",
    hint: "The work you can point to, so a tool can name the right project for each client.",
    titleField: "name",
    subtitleFields: ["role"],
    fields: [
      { key: "name", label: "Project name", kind: "text", required: true, placeholder: "Agency portfolio platform", half: true },
      { key: "role", label: "Your role", kind: "text", placeholder: "Lead developer", half: true },
      {
        key: "summary",
        label: "Project summary",
        kind: "longText",
        required: true,
        hint: "What it is and what it does, in a few sentences.",
        placeholder: "A professional corporate portfolio platform showcasing full-stack development services, case studies and testimonials...",
      },
      { key: "url", label: "Link", kind: "url", placeholder: "https://example.com" },
      { key: "highlights", label: "What stands out", kind: "lines", hint: "One point per line: what makes this project worth showing.", placeholder: "Comprehensive service ecosystem covering full-stack, API and DevOps\nStrong emphasis on scalability" },
      { key: "bestMatches", label: "Strongest Upwork matches", kind: "lines", hint: "One kind of job per line that this project proves you can do.", placeholder: "Custom web application development\nSaaS platform development" },
      {
        key: "proposalMatches",
        label: "Feature-level proposal matching",
        kind: "pairs",
        hint: "When a client needs something, what of this project to emphasize.",
        pairLabels: ["If the client needs...", "Emphasize..."],
      },
      { key: "technologies", label: "Technologies", kind: "chips", hint: "Press Enter or type a comma after each.", placeholder: "Next.js, Stripe, AWS" },
      { key: "keywords", label: "Search keywords", kind: "chips", hint: "Words this project should be found by.", placeholder: "SaaS marketing, lead generation" },
    ],
  },
  {
    id: "skills",
    label: "Skills",
    noun: "skill",
    hint: "What you are good at, so a tool only claims what you can really do.",
    titleField: "name",
    subtitleFields: ["level", "category"],
    fields: [
      { key: "name", label: "Skill", kind: "text", required: true, placeholder: "React", half: true },
      { key: "category", label: "Category", kind: "text", placeholder: "Frontend", half: true },
      { key: "level", label: "Level", kind: "choice", options: SKILL_LEVELS, half: true },
      { key: "years", label: "Years of use", kind: "number", min: 0, upTo: 60, half: true },
      { key: "evidence", label: "Where you used it", kind: "longText", max: 2000, hint: "The projects or roles that prove it.", placeholder: "Built the booking platform's whole frontend in React..." },
    ],
  },
  {
    id: "services",
    label: "Services",
    noun: "service",
    hint: "What you offer clients, so a pitch names a service you really sell.",
    titleField: "name",
    subtitleFields: ["forWhom", "startingPrice", "timeline"],
    fields: [
      { key: "name", label: "Service", kind: "text", required: true, placeholder: "MVP development for SaaS founders" },
      { key: "description", label: "What it is", kind: "longText", required: true, placeholder: "I take a SaaS idea from a spec to a launched product..." },
      { key: "forWhom", label: "Who it is for", kind: "text", placeholder: "Non-technical founders", half: true },
      { key: "startingPrice", label: "Starting price", kind: "text", placeholder: "$3,000", half: true },
      { key: "timeline", label: "Typical timeline", kind: "text", placeholder: "4 to 6 weeks", half: true },
      { key: "includes", label: "What it includes", kind: "lines", hint: "One per line.", placeholder: "Design in Figma\nNext.js app with auth and payments\nDeployment" },
      { key: "proof", label: "Projects that prove it", kind: "lines", hint: "One per line, named as on the Projects tab." },
    ],
  },
  {
    id: "education",
    label: "Education",
    noun: "school",
    hint: "Where you studied and what you studied there.",
    titleField: "school",
    subtitleFields: ["degree", "field", "grade"],
    dates: ["startMonth", "endMonth"],
    fields: [
      { key: "school", label: "School", kind: "text", required: true, placeholder: "University of the Punjab" },
      { key: "degree", label: "Degree", kind: "text", placeholder: "BS", half: true },
      { key: "field", label: "Field of study", kind: "text", placeholder: "Computer Science", half: true },
      { key: "startMonth", label: "Started", kind: "month", half: true },
      { key: "endMonth", label: "Finished", kind: "month", half: true },
      { key: "grade", label: "Grade", kind: "text", placeholder: "CGPA 3.6", half: true },
      { key: "notes", label: "Notes", kind: "longText", max: 2000, placeholder: "Final year project, societies, awards..." },
    ],
  },
  {
    id: "certifications",
    label: "Certifications",
    noun: "certificate",
    hint: "The certificates you hold, with who issued them and when.",
    titleField: "name",
    subtitleFields: ["issuer", "credentialId"],
    dates: ["issued", "expires"],
    fields: [
      { key: "name", label: "Certificate", kind: "text", required: true, placeholder: "AWS Certified Solutions Architect – Associate" },
      { key: "issuer", label: "Issued by", kind: "text", required: true, placeholder: "Amazon Web Services", half: true },
      { key: "credentialId", label: "Credential ID", kind: "text", half: true },
      { key: "issued", label: "Issued", kind: "month", half: true },
      { key: "expires", label: "Expires", kind: "month", half: true },
      { key: "url", label: "Credential link", kind: "url", placeholder: "https://..." },
      { key: "skills", label: "Skills it covers", kind: "chips", placeholder: "Cloud architecture, IAM" },
    ],
  },
  {
    id: "reviews",
    label: "Reviews",
    noun: "review",
    hint: "What clients have said about your work, to quote word for word.",
    titleField: "clientName",
    subtitleFields: ["clientRole", "project", "platform"],
    dates: ["date"],
    fields: [
      { key: "clientName", label: "Client", kind: "text", required: true, placeholder: "Sara Ahmed", half: true },
      { key: "clientRole", label: "Their role or company", kind: "text", placeholder: "Founder, Bookly", half: true },
      { key: "project", label: "Project", kind: "text", placeholder: "Booking platform", half: true },
      { key: "platform", label: "Where it was left", kind: "choice", options: REVIEW_PLATFORMS, half: true },
      { key: "rating", label: "Rating (out of 5)", kind: "choice", options: RATINGS, half: true },
      { key: "date", label: "When", kind: "month", half: true },
      { key: "review", label: "The review, word for word", kind: "longText", required: true, placeholder: "Abdul delivered ahead of schedule..." },
      { key: "url", label: "Link to the review", kind: "url" },
    ],
  },
]

export type ProfileSectionId = (typeof PROFILE_SECTIONS)[number]["id"]
export const PROFILE_SECTION_IDS = PROFILE_SECTIONS.map((section) => section.id)
export const sectionById = (id: string): ProfileSection | undefined => PROFILE_SECTIONS.find((section) => section.id === id)

// Profile Info is the one tab that is not a section: the free text every tool quotes today
export const PROFILE_INFO_TAB = "profile"

/** The tabs in the order a profile is read: who you are, what you have done, what you offer, what proves it. */
export const MY_PROFILE_TABS: readonly { id: string; label: string; hint: string }[] = [
  { id: PROFILE_INFO_TAB, label: "Profile Info", hint: "Who you are, your experience and your skills. Every tool quotes from this and never invents beyond it." },
  ...PROFILE_SECTIONS.map(({ id, label, hint }) => ({ id, label, hint })),
]
export const DEFAULT_MY_PROFILE_TAB = PROFILE_INFO_TAB
export const isMyProfileTab = (value: string | null): value is string => MY_PROFILE_TABS.some((tab) => tab.id === value)

export const MY_PROFILE_ENDPOINT = "/api/my-profile"

// The most one person may search their own profile for at once, and how long a question may be
export const PROFILE_SEARCH_RESULTS = 6
export const PROFILE_SEARCH_MAX_LENGTH = 500
// A match closer than this is shown; anything further says nothing about the question
export const PROFILE_SEARCH_MIN_SCORE = 0.55
// An entry longer than this is embedded in pieces, each cut at a line end, so no meaning is lost to Gemini's limit
export const EMBED_PIECE_MAX_CHARS = 6000

export const MY_PROFILE_MESSAGES = {
  loadFailed: "Your profile could not be loaded. Try again in a moment.",
  saveFailed: "That could not be saved. Try again in a moment.",
  deleteFailed: "That could not be deleted. Try again in a moment.",
  notFound: "That entry no longer exists.",
  unknownSection: "That part of the profile does not exist.",
  saved: "Saved.",
  deleted: "Deleted.",
  moveFailed: "The new order could not be saved, so the list was read again.",
  // What a search of one's own profile says
  searchLabel: "Search your profile the way a tool will",
  searchHint: "Ask anything, such as \"payments experience\" or \"a project for a booking startup\", to see which parts of your profile match.",
  searchPlaceholder: "a project that shows Stripe payments",
  searchNothing: "Nothing in your profile matches that closely.",
  searchFailed: "The search did not run. Try again in a moment.",
  // How the profile stands in search
  indexReady: "Everything is saved for search.",
  indexPending: (count: number) => `${count} ${count === 1 ? "part is" : "parts are"} waiting to be saved for search.`,
  indexFailed: (count: number) => `${count} ${count === 1 ? "part" : "parts"} could not be saved for search.`,
  indexRetry: "Try again",
  indexing: "Saving for search...",
  indexUnavailable: (missing: string) => `Search is not set up on this deployment: it needs ${missing}. Your profile is still saved.`,
  importedProjects: (count: number) => `${count} ${count === 1 ? "project" : "projects"} kept in this browser before ${count === 1 ? "was" : "were"} saved to your account.`,
} as const
