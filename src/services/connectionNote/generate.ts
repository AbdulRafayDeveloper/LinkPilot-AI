import { z } from "zod"
import { HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages"
import { generateStructuredWithFallback, type ModelProvider } from "@/services/ai"
import { loadPrompt, renderPrompt } from "@/services/prompts"
import { composePromptMessage, type PromptDataBlock } from "@/services/promptComposer"
import { humanizeTexts } from "@/services/humanizer"
import { getFullSenderProfile } from "@/services/senderProfile"
import { findInventedProof, findUnsupportedUserClaims } from "@/services/userClaims"
import { containsSenderClaim } from "@/services/senderGuard"
import { cleanGeneratedText as cleanNote, containsPlaceholder } from "@/lib/generatedText"
import { findUnsupportedFigures } from "@/lib/figures"
import { SITE_AUTHOR } from "@/config/site"
import {
  COMPANY_TONES,
  CONNECTION_NOTE_MAX_CHARS,
  getToneLabel,
  type CompanyTone,
  type ConnectionNoteToneId,
} from "@/constants/connectionNote"
import type { GeneratedConnectionNote } from "@/types/connectionNote"
import { getActiveTonePrompt } from "./prompts"

// Slightly creative so notes read naturally rather than templated
const WRITING_TEMPERATURE = 0.7
// Targeted rewrites for a draft with problems (see findProblems); the cleanest version wins
const MAX_REWRITES = 2
const SENDER_PROFILE_VARIABLE = "sender_profile"
// Stock openers every tone prompt bans; they make a note read like a template
const CLICHE =
  /\b(?:it is great to see|it's great to see|i came across your (?:profile|page)|i would love to connect|i'd love to connect|your journey(?: \w+){0,12} (?:is )?(?:really |truly |so )?inspiring|impressive journey)\b/i
// Notes are sent from the owner's account: their full name never appears, and the note never signs off
// with their first name (a recipient may share that first name, so it's only caught at the end)
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const SENDER_NAME = new RegExp(`\\b${escapeRegExp(SITE_AUTHOR)}\\b`, "i")
const SENDER_SIGN_OFF = new RegExp(`\\b${escapeRegExp(SITE_AUTHOR.split(" ")[0])}[.!]?\\s*$`, "i")
// "Sara, congratulations...", "Hi Sara, congratulations..." or "Hi, Sara": the tone prompts write the name
// straight into the sentence ("Sara congratulations...", "Hi Sara congratulations...")
const PUNCTUATION_AFTER_NAME = /^(?:Hi\s+)?\p{Lu}[\p{L}'-]*[,.]\s|^Hi[,.!]/u
// The opening the company tones require: "Hi" and then the first name
const OPENS_WITH_HI = /^Hi\s+\p{Lu}/u
// A sentence about the sender, whose figures must come from the sender's own profile
const FIRST_PERSON = /\b(?:I|[Mm]y|[Mm]e|[Mm]ine)\b/
// Words that introduce a figure as the recipient's own ("your $2.5M round")
const RECIPIENT_REFERENCE = /\b(?:your|you|their|they)\b/i
// Any number in a sentence about the sender, with or without a unit ("12,000 bookings", "70+", "$2.5M")
const ANY_NUMBER = /[$€£]?\d(?:[\d,.]*\d)?(?:\s?[kKmMbB]\b|\+|%)?/g
const LINK = /https?:\/\/[^\s)<>"]+/g
const SENTENCE_BOUNDARY = /(?<=[.!?])\s+/
// Compares numbers loosely: "12,000" = "12000", "$2.5 M" = "$2.5m"
const normalizeNumber = (text: string) => text.toLowerCase().replace(/[\s,]/g, "")
// News about the recipient's company a note may only state when their pasted profile does, or when the
// user said so by choosing a company tone and naming the company (COMPANY_TONES)
const PROFILE_ONLY_NEWS = [
  {
    kind: "funding",
    pattern: /\b(?:fund(?:ing|ed|raise|raising)?|raised|raising|seed round|pre-seed|series [a-e]\b|investors?|investment|backed by|valuation)\b/i,
    problem:
      "It mentions funding, but the profile never says this person or their company raised money. Remove every mention of funding and congratulate them on a real milestone the profile states instead.",
  },
  {
    kind: "hiring",
    pattern:
      /\b(?:hiring|recruit(?:s|ing|ment)?|open (?:roles?|positions?)|job openings?|vacanc(?:y|ies)|headcount|(?:build|building|grow|growing|expand|expanding|scale|scaling) (?:\w+ ){0,2}(?:team|teams))\b/i,
    problem:
      "It says they are hiring, but the profile never mentions hiring or open roles. Remove that and speak to what they are building and how the company is growing.",
  },
] as const

// The news a note states that neither the pasted profile nor the user (statedNews) gives, as rewrite instructions
const findUnstatedNews = (note: string, profileData: string, statedNews: CompanyTone["news"] | null) =>
  PROFILE_ONLY_NEWS.filter(({ kind, pattern }) => kind !== statedNews && pattern.test(note) && !pattern.test(profileData)).map(
    ({ problem }) => problem
  )

// Distinctive words (6+ letters), compared by their first 6 letters so "systems" matches "system"
const stemsOf = (text: string) => new Set((text.toLowerCase().match(/[a-z][a-z-]{5,}/g) ?? []).map((word) => word.slice(0, 6)))

/**
 * "I have built AI scheduling systems" written to a scheduling startup: a sentence about the
 * user's own work (no "your" or "their" in it) that borrows a distinctive word from the
 * recipient's profile which the user's own profile never uses. Returns those words.
 */
function findMirroredWords(note: string, profileData: string, senderProfile: string): string[] {
  const theirs = stemsOf(profileData)
  const mine = stemsOf(senderProfile)
  return note
    .split(SENTENCE_BOUNDARY)
    .filter((sentence) => FIRST_PERSON.test(sentence) && !RECIPIENT_REFERENCE.test(sentence) && containsSenderClaim(sentence))
    .flatMap((sentence) => sentence.toLowerCase().match(/[a-z][a-z-]{5,}/g) ?? [])
    .filter((word) => theirs.has(word.slice(0, 6)) && !mine.has(word.slice(0, 6)))
}

// "I have some big news about raising the seed round": the recipient's news told as the sender's own
const findNewsClaimedAsOwn = (note: string) =>
  note
    .split(SENTENCE_BOUNDARY)
    .find(
      (sentence) =>
        FIRST_PERSON.test(sentence) &&
        !RECIPIENT_REFERENCE.test(sentence) &&
        PROFILE_ONLY_NEWS.some(({ pattern }) => pattern.test(sentence))
    )
const NO_SENDER_PROFILE_TEXT =
  "The user hasn't written about their own work yet, so say nothing about their services, skills or experience."

// The user's own profile (About me + Rafay Profile Info), loaded only when the tone prompt uses it
interface SenderProfile {
  isUsed: boolean
  text: string | null
}

const NOTE_FIELD = z.string().describe("The complete connection note text, nothing else")

const NoteSchema = z.object({ note: NOTE_FIELD })

// For tones that see the user's profile: the fit analysis comes first, so the note is written around it
const FitNoteSchema = z.object({
  recipient_need: z
    .string()
    .describe("From PROFILE, in one line: what the recipient's company builds and what it needs next (what the funding is for, or the roles it is hiring)"),
  my_best_match: z
    .string()
    .describe("From ABOUT ME, in its own words: the one project, product, skill or result of the sender that best fits that need"),
  note: NOTE_FIELD,
})

// One written note, with the fit analysis behind it when the tone uses the user's profile
interface Draft {
  note: string
  provider: ModelProvider
  fit: { recipientNeed: string; myBestMatch: string } | null
}

interface GenerateOptions {
  profileData: string
  tone: ConnectionNoteToneId
  // The company the user named for a company tone (COMPANY_TONES); ignored by the other tones
  companyName?: string
  signal: AbortSignal
}

// A company tone's setup for one note: the company the user named (null = take it from the profile)
interface CompanyContext {
  tone: CompanyTone
  name: string | null
}

function findUnusableReason({ note }: { note: string }): string | null {
  const cleaned = cleanNote(note)
  if (!cleaned) return "empty note"
  if (containsPlaceholder(cleaned)) return "note contains a placeholder"
  return null
}

/**
 * Keeps the three instruction layers separate: application rules in the system message,
 * the saved tone prompt as the user's instructions, and the pasted profile inside
 * delimiter tags it cannot close. {{profile_data}} places the profile block where the
 * prompt wants it; otherwise the block is appended. {{tone}} inserts the tone name.
 * {{sender_profile}} adds the user's own profile, only for tones whose prompt asks for it, and
 * {{company_name}} the company the user named, only for company tones.
 */
async function buildMessages(
  tonePrompt: string,
  tone: ConnectionNoteToneId,
  profileData: string,
  senderProfile: SenderProfile,
  company: CompanyContext | null
): Promise<BaseMessage[]> {
  const system = renderPrompt(await loadPrompt("connection-note-system"), { MAX_CHARS: CONNECTION_NOTE_MAX_CHARS })
  const blocks: PromptDataBlock[] = [{ variable: "profile_data", tag: "profile_data", label: "Profile", content: profileData }]
  if (company) {
    blocks.push({
      variable: "company_name",
      tag: "company_name",
      label: "Company",
      content: company.name,
      emptyText: "Not given. Take the company from PROFILE.",
    })
  }
  if (senderProfile.isUsed) {
    blocks.push({
      variable: SENDER_PROFILE_VARIABLE,
      tag: "sender_profile",
      label: "About me",
      content: senderProfile.text,
      emptyText: NO_SENDER_PROFILE_TEXT,
    })
  }
  const userMessage = composePromptMessage(tonePrompt, blocks, { tone: getToneLabel(tone) })
  return [new SystemMessage(system), new HumanMessage(userMessage)]
}

function lengthWarning(length: number): string | null {
  return length > CONNECTION_NOTE_MAX_CHARS
    ? `This note is ${length} characters, over LinkedIn's ${CONNECTION_NOTE_MAX_CHARS}-character limit. Shorten it before sending.`
    : null
}

// A stock phrase, the sender's own name, or a comma after the recipient's name, which every tone prompt forbids
function findStyleSlip(note: string): string | null {
  if (SENDER_NAME.test(note) || SENDER_SIGN_OFF.test(note)) {
    return `It uses your own name, ${SITE_AUTHOR}. The note is sent from your account, so address the recipient by their first name from the profile and never write or sign with your name.`
  }
  const cliche = note.match(CLICHE)?.[0]
  if (cliche) return `It says "${cliche}", a stock phrase. Say something specific to this person instead.`
  return PUNCTUATION_AFTER_NAME.test(note)
    ? "It puts a comma or full stop after the greeting or the first name. Write the name straight into the first sentence, like \"Sara congratulations on...\" or \"Hi Sara congratulations on...\"."
    : null
}

// Figures in sentences about the sender that the sender's own words don't state: usually the
// recipient's numbers (their users, bookings, funding) presented as the sender's results
function findBorrowedFigures(note: string, ownText: string): string[] {
  const ownFigures = normalizeNumber(ownText)
  return note
    .split(SENTENCE_BOUNDARY)
    .filter((sentence) => FIRST_PERSON.test(sentence))
    .flatMap((sentence) =>
      [...sentence.matchAll(ANY_NUMBER)].filter((match) => {
        // "I saw your $2.5M round" is about them; only a figure not introduced as theirs is claimed as the sender's
        const before = sentence.slice(Math.max(0, match.index - 40), match.index)
        return !RECIPIENT_REFERENCE.test(before) && !ownFigures.includes(normalizeNumber(match[0]))
      })
    )
    .map((match) => match[0].trim())
}

/**
 * LinkedIn refuses a note over its limit, so when rewrites couldn't shorten it, a middle
 * sentence goes: never the opening (the personal detail), the closing ask or a sentence that
 * carries a required link. The shortest one that brings the note under the limit is chosen,
 * so as little as possible is lost.
 */
function fitWithinLimit(note: string, links: string[]): string {
  let sentences = note.split(SENTENCE_BOUNDARY)
  while (sentences.join(" ").length > CONNECTION_NOTE_MAX_CHARS) {
    const removable = sentences
      .map((sentence, index) => ({ sentence, index }))
      .filter(({ sentence, index }) => index > 0 && index < sentences.length - 1 && !links.some((link) => sentence.includes(link)))
      .sort((a, b) => a.sentence.length - b.sentence.length)
    if (removable.length === 0) break
    const total = sentences.join(" ").length
    const pick = removable.find(({ sentence }) => total - sentence.length - 1 <= CONNECTION_NOTE_MAX_CHARS) ?? removable[removable.length - 1]
    sentences = sentences.filter((_, index) => index !== pick.index)
  }
  return sentences.join(" ")
}

// What a draft is checked against: every source, the recipient's profile, and the user's own words
// (their profile plus the tone prompt they wrote, which may give facts like a portfolio or a call length)
interface NoteSources {
  all: string
  profileData: string
  own: string
  // The user's profile alone: claims about their work must be backed by it, not by the tone prompt's examples
  senderProfile: string
  // Links the tone prompt gives (a portfolio); a note may use these and no others
  links: string[]
  // Company tones: the note opens with "Hi", names the company the user gave, and may state its news
  company: CompanyContext | null
}

// Links in a text, without the full stop or comma that can follow one at the end of a sentence
const linksIn = (text: string) => (text.match(LINK) ?? []).map((link) => link.replace(/[.,!?]+$/, ""))

// What's wrong with a draft, as instructions for the rewrite: a stock phrase, funding or hiring the pasted
// profile never mentions, over the limit, figures no source contains, claims about the user's work their
// own words don't support, invented proof, or the recipient's figures claimed as the sender's
function findProblems(note: string, { all: sources, profileData, own, senderProfile, links, company }: NoteSources): string[] {
  const problems: string[] = []
  const slip = findStyleSlip(note)
  if (slip) problems.push(slip)
  if (company && !OPENS_WITH_HI.test(note)) {
    problems.push('It must open with "Hi" and then the recipient\'s first name, like "Hi Sara congratulations on...".')
  }
  if (company?.name && !note.toLowerCase().includes(company.name.toLowerCase())) {
    problems.push(`It never names ${company.name}. Name the company exactly as "${company.name}".`)
  }
  // With a company named, the user has told us its news: the funding or hiring the tone is about
  problems.push(...findUnstatedNews(note, profileData, company?.name ? company.tone.news : null))
  const newsAsOwn = findNewsClaimedAsOwn(note)
  if (newsAsOwn) {
    problems.push(
      `"${newsAsOwn}" reads as if you raised the money or are hiring. That news is theirs. Speak to them about it ("congratulations on your seed round") and keep "I" for your own work.`
    )
  }
  const extraLinks = linksIn(note).filter((link) => !links.includes(link))
  if (extraLinks.length > 0) problems.push(`It adds a link the instructions don't give: ${extraLinks.join(", ")}. Remove it.`)
  const missingLinks = links.filter((link) => !note.includes(link))
  if (missingLinks.length > 0) problems.push(`It leaves out ${missingLinks.join(" and ")}. Include it exactly as written.`)
  if (note.length > CONNECTION_NOTE_MAX_CHARS) {
    problems.push(
      `It is ${note.length} characters. Rewrite it in at most ${CONNECTION_NOTE_MAX_CHARS} characters including spaces, and end on a complete sentence.`
    )
  }
  const figures = findUnsupportedFigures(note, sources)
  if (figures.length > 0) {
    problems.push(
      `It states figures that neither profile contains: ${figures.join(", ")}. Remove them or use the exact figure the profile states. Never invent funding amounts, rounds or results.`
    )
  }
  // Claims about the user's work must be backed by the user's own profile, not the recipient's
  // The company the user named is theirs to mention, so its name never counts as borrowed wording
  const mirrored = senderProfile ? [...new Set(findMirroredWords(note, profileData, `${senderProfile}\n${company?.name ?? ""}`))] : []
  if (mirrored.length > 0) {
    problems.push(
      `It describes your own work with their words (${mirrored.join(", ")}), which your profile (ABOUT ME) never uses. Name your real project in ABOUT ME's words instead of reshaping it to match their product.`
    )
  }
  const [claim] = findUnsupportedUserClaims(note, senderProfile)
  if (claim) {
    problems.push(
      `It says "${claim}", but your profile (ABOUT ME) does not state that. Describe only work your profile states, or leave your background out.`
    )
  }
  const proof = findInventedProof(note, sources)
  if (proof.length > 0) problems.push(`It mentions ${proof.join(", ")}, which neither profile states. Remove it.`)
  const borrowed = findBorrowedFigures(note, own).filter((figure) => !figures.includes(figure))
  if (borrowed.length > 0) {
    problems.push(
      `It presents ${borrowed.join(", ")} as your own result, but that figure is not in your profile (ABOUT ME). Their numbers belong to them. Use a figure from your profile or none.`
    )
  }
  return problems
}

/**
 * Generates one note with the latest saved prompt for the tone. A draft with a problem (see
 * findProblems) gets one controlled rewrite instead of being truncated or patched; the rewrite
 * is kept only when it fixes more than it breaks. The final note is rewritten with the
 * Humanization prompt, which may not bring those problems back.
 */
export async function generateConnectionNote({ profileData, tone, companyName, signal }: GenerateOptions): Promise<GeneratedConnectionNote> {
  const tonePrompt = await getActiveTonePrompt(tone)
  const usesSenderProfile = tonePrompt.includes(`{{${SENDER_PROFILE_VARIABLE}}}`)
  const senderProfile: SenderProfile = { isUsed: usesSenderProfile, text: usesSenderProfile ? await getFullSenderProfile() : null }
  const companyTone = COMPANY_TONES[tone]
  const company: CompanyContext | null = companyTone ? { tone: companyTone, name: companyName?.trim() || null } : null
  const messages = await buildMessages(tonePrompt, tone, profileData, senderProfile, company)
  const own = [senderProfile.text ?? "", tonePrompt].join("\n")
  const sources: NoteSources = {
    all: `${profileData}\n${own}\n${company?.name ?? ""}`,
    profileData,
    own,
    senderProfile: senderProfile.text ?? "",
    links: [...new Set(linksIn(tonePrompt))],
    company,
  }

  // Tones with the user's profile first write down the fit (what they need, the user's best match), then the note
  const write = async (thread: BaseMessage[]): Promise<Draft> => {
    const options = { name: "connection_note", messages: thread, temperature: WRITING_TEMPERATURE, signal, validate: findUnusableReason }
    if (!senderProfile.isUsed) {
      const { data, provider } = await generateStructuredWithFallback({ schema: NoteSchema, ...options })
      return { note: cleanNote(data.note), provider, fit: null }
    }
    const { data, provider } = await generateStructuredWithFallback({ schema: FitNoteSchema, ...options })
    return { note: cleanNote(data.note), provider, fit: { recipientNeed: data.recipient_need, myBestMatch: data.my_best_match } }
  }

  const first = await write(messages)
  let { note, provider, fit } = first
  let problems = findProblems(note, sources)

  for (let attempt = 0; attempt < MAX_REWRITES && problems.length > 0; attempt++) {
    const rewrite = await write([
      ...messages,
      new HumanMessage(
        `Rewrite your draft below. ${problems.join(" ")} Keep the same tone, personalization and meaning.\n\n<draft_note>\n${note}\n</draft_note>`
      ),
    ]).catch((error: unknown) => {
      if (signal.aborted) throw error
      console.warn("⚠️ Connection note rewrite failed; keeping the current draft:", error)
      return null
    })
    if (!rewrite) break

    const remaining = findProblems(rewrite.note, sources)
    if (remaining.length < problems.length || (remaining.length === problems.length && rewrite.note.length < note.length)) {
      note = rewrite.note
      provider = rewrite.provider
      fit = rewrite.fit ?? fit
      problems = remaining
    }
  }

  // Last resort: a sentence that still claims their numbers as the user's goes, rather than a false claim
  const stillBorrowed = findBorrowedFigures(note, own)
  if (stillBorrowed.length > 0) {
    const kept = note
      .split(SENTENCE_BOUNDARY)
      .filter((sentence) => findBorrowedFigures(sentence, own).length === 0)
      .join(" ")
    if (kept) note = kept
  }
  note = fitWithinLimit(note, sources.links)

  const draftProblemCount = findProblems(note, sources).length
  const humanization = await humanizeTexts({
    fields: [{ id: "note", kind: "LinkedIn connection request note", text: note, maxChars: CONNECTION_NOTE_MAX_CHARS }],
    signal,
    // The humanized note may not bring back anything the checks above removed (perspective, claims, names...)
    validate: (_id, text) => {
      const problemsAfter = findProblems(text, sources)
      return problemsAfter.length > draftProblemCount ? problemsAfter[0] : null
    },
  })
  note = humanization.texts.note

  console.info(
    "Connection note generated:",
    JSON.stringify({
      tone,
      provider,
      humanized: humanization.humanized,
      characters: note.length,
      senderProfile: senderProfile.isUsed,
      unresolved: problems.length,
      ...(fit ? { recipientNeed: fit.recipientNeed, myBestMatch: fit.myBestMatch } : {}),
    })
  )
  return {
    note,
    tone,
    characterCount: note.length,
    maxCharacters: CONNECTION_NOTE_MAX_CHARS,
    warning: lengthWarning(note.length),
  }
}
