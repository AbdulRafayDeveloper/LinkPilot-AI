import { SITE_AUTHOR } from "@/config/site"

/**
 * Who a generation was written for, as far as the pasted text shows it. Stored with each
 * saved output so records can be found by person. Every field is null when the text doesn't show it.
 */
export interface LeadInfo {
  name: string | null
  headline: string | null
  company: string | null
}

const SCAN_LINES = 80
const HEADLINE_MAX_CHARS = 220
const COMPANY_MAX_CHARS = 80
// LinkedIn page text copied along with a profile
const PAGE_CHROME = new Set([
  "search", "home", "my network", "jobs", "messaging", "notifications", "me", "for business", "hire with ai",
  "cover photo", "background image", "skip to main content", "open to", "share", "more", "connect", "message",
  "follow", "contact info", "about", "activity", "experience", "education", "skills", "verified",
])
const NAME = /^[\p{Lu}][\p{L}'.-]*(?:\s+[\p{L}][\p{L}'.-]*){0,4}$/u
const DEGREE = /(?:^|·)\s*(?:1st|2nd|3rd\+?)\s*$/i
const PRONOUNS = /^\(?(?:he|she|they)\/(?:him|her|them)\)?$/i
const COMPANY = /\b(?:at|@)\s+([^|,·•]+)/i
// "Emily Carter  Sep 10, 2026, 6:45 PM" or "Emily Carter sent the following message at 6:45 PM"
const SENDER_LINE = /^([\p{Lu}][\p{L}'.-]*(?:\s+[\p{L}][\p{L}'.-]*){0,3})(?:\s{2,}\S|\s+sent the following messages?\b)/u

const isName = (line: string) => line.length <= 60 && NAME.test(line) && !PAGE_CHROME.has(line.toLowerCase())
const isOwner = (name: string) => name.toLowerCase() === SITE_AUTHOR.toLowerCase()
const EMPTY: LeadInfo = { name: null, headline: null, company: null }

function companyFrom(headline: string | null): string | null {
  const company = headline?.match(COMPANY)?.[1]?.trim()
  return company ? company.slice(0, COMPANY_MAX_CHARS) : null
}

/**
 * Name, headline and company from pasted LinkedIn profile text. The name is the line before
 * the connection degree ("· 2nd") when there is one, otherwise the first name-like line; the
 * headline is the next real line after it.
 */
export function leadFromProfile(profile: string | null | undefined): LeadInfo {
  const lines = (profile ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, SCAN_LINES)
  const degree = lines.findIndex((line) => DEGREE.test(line))
  const nameIndex =
    degree > 0
      ? [degree - 1, degree - 2, degree - 3].find((index) => index >= 0 && isName(lines[index])) ?? -1
      : lines.findIndex(isName)
  if (nameIndex < 0) return EMPTY

  const headline =
    lines
      .slice(nameIndex + 1, nameIndex + 6)
      .find((line) => !DEGREE.test(line) && !PRONOUNS.test(line) && !PAGE_CHROME.has(line.toLowerCase()) && /\p{L}{2}/u.test(line))
      ?.slice(0, HEADLINE_MAX_CHARS) ?? null
  return { name: lines[nameIndex], headline, company: companyFrom(headline) }
}

/**
 * The other person in a pasted conversation: from their profile when one was pasted, otherwise
 * the first sender line that isn't the owner, otherwise the name the analysis found.
 */
export function leadFromConversation(conversation: string, profile: string | null, fallbackName: string | null = null): LeadInfo {
  const fromProfile = leadFromProfile(profile)
  if (fromProfile.name) return fromProfile

  for (const line of conversation.split(/\r?\n/)) {
    const name = line.trim().match(SENDER_LINE)?.[1]
    if (name && !isOwner(name) && !PAGE_CHROME.has(name.toLowerCase())) return { ...EMPTY, name }
  }
  return { ...EMPTY, name: fallbackName }
}
