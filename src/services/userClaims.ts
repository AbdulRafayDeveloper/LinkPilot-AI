import { containsSenderClaim } from "@/services/senderGuard"

// "I'm currently exploring…", "we've been building…": the current-work claims models invent
// when asked "what are you working on?"
const CURRENT_WORK_CLAIM =
  /\b(?:I'm|I am|I've been|we're|we are|we've been)\s+(?:(?:currently|also|now|mostly|mainly|actually)\s+)?(?:exploring|working|building|developing|focusing|diving|researching|experimenting|designing|creating|launching|leading|running|helping|scaling|optimizing|optimising|improving|enhancing|implementing|shipping|automating|studying|learning)\b/i
// Social proof models invent to back a pitch: case studies, unnamed similar companies and
// results in words ("cut it in half") that no number check can see
const INVENTED_PROOF =
  /\bcase stud(?:y|ies)\b|\b(?:a|one|another)\s+(?:similar|recent|former|past)\s+(?:client|company|team|startup|business|customer)\b|\b(?:helped|worked with)\s+(?:other|similar|many|several|lots of|dozens of)\s+(?:companies|teams|clients|startups|businesses|customers)\b|\b(?:in|by) half\b|\b(?:halved|doubled|tripled)\b/gi
const SENTENCE_BOUNDARY = /(?<=[.!?])\s+/
const WORD = /[a-z][a-z0-9-]{3,}/g
// Words are compared by their first letters so "library" matches "libraries"
const STEM_LENGTH = 6
// A claim whose content words mostly don't appear in the sources is treated as invented
const MIN_SUPPORTED_SHARE = 0.5

// Claim verbs and filler that say nothing about what the work actually is
const NEUTRAL_WORDS = new Set([
  "currently", "exploring", "working", "building", "developing", "focusing", "diving", "researching",
  "experimenting", "designing", "creating", "launching", "leading", "running", "helping", "scaling",
  "optimizing", "optimising", "improving", "enhancing", "implementing", "shipping", "automating",
  "studying", "learning", "also", "mostly", "mainly", "actually", "been", "have", "that", "this", "these",
  "those", "with", "from", "into", "about", "your", "yours", "their", "there", "some", "more", "much",
  "ways", "things", "something", "really", "always", "similar", "space", "area", "field", "lately",
  "recently", "days", "what", "when", "which", "while", "would", "could", "should", "like",
  "love", "great", "happy", "glad", "interesting", "impressive", "work", "stuff", "bit",
  // Courtesy phrases such as "thanks for your interest in my work" describe nothing
  "thanks", "thank", "interest", "interested", "asking", "question", "questions", "curious", "kind", "words",
])

function contentStems(text: string): string[] {
  return (text.toLowerCase().match(WORD) ?? [])
    .filter((word) => !NEUTRAL_WORDS.has(word))
    .map((word) => word.slice(0, STEM_LENGTH))
}

/**
 * Sentences in which the reply describes the user's own work, experience or current
 * projects in terms the sources don't contain. Sources are the About Me text and the
 * pasted conversation, so a restatement of what the user already said passes.
 */
export function findUnsupportedUserClaims(reply: string, sourceText: string): string[] {
  const sourceStems = new Set(contentStems(sourceText))
  return reply
    .split(SENTENCE_BOUNDARY)
    .map((sentence) => sentence.trim())
    .filter((sentence) => containsSenderClaim(sentence) || CURRENT_WORK_CLAIM.test(sentence))
    .filter((sentence) => {
      const stems = contentStems(sentence)
      if (stems.length === 0) return false
      const supported = stems.filter((stem) => sourceStems.has(stem)).length
      return supported / stems.length < MIN_SUPPORTED_SHARE
    })
}

/**
 * Case studies, unnamed similar companies and worded results ("in half") in the text that
 * the sources don't mention. With nothing known about the user's past work, these are made up.
 */
export function findInventedProof(text: string, sourceText: string): string[] {
  const sources = sourceText.toLowerCase()
  const matches = [...text.matchAll(INVENTED_PROOF)].map((match) => match[0])
  return [...new Set(matches.filter((match) => !sources.includes(match.toLowerCase())))]
}
