import type { ActionItem, MeetingParticipant } from "@/types/meetings"

/**
 * Who was in a meeting, and how their name is written.
 *
 * **A recording has no speaker labels.** Whisper writes down what was said and nothing about who
 * said it, so the only trace of a person is their name being spoken, and it is spelled differently
 * every time it is heard: one real meeting gave "Raffae", "Rafa", "Rafael" and "Raphail Sinadovica"
 * for the same man, plus "Lukas" for Lucas and "Christian" for Cristiana. Listing each of those as
 * a participant turned a meeting of four people into one of ten.
 *
 * So two things happen here, and they are kept apart from the service so they can be read and
 * tested on their own:
 *   - the names that are plainly the same person are folded together, and anything close to the
 *     user's own name becomes the user, since a model cannot know that "Rafa" is them;
 *   - when the user has said who was in the meeting, that list is the answer and the transcript's
 *     spellings are matched to it, which is the only way to be exact about a recording.
 */

// A label the analysis gives a speaker it could not name; it is not a person's name
const UNNAMED = /^unnamed speaker(\s+\d+)?$/i

/** A name with its accents, punctuation and case taken off, for comparing two spellings. */
export const plainName = (name: string): string =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

/** How many single-character edits turn one word into the other. */
function distance(a: string, b: string): number {
  if (a === b) return 0
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    previous = row
  }
  return previous[b.length]
}

/** 1 when two words are the same, 0 when they share nothing. */
export const similarity = (a: string, b: string): number =>
  a === b ? 1 : 1 - distance(a, b) / Math.max(a.length, b.length)

const nameWords = (name: string): string[] => plainName(name).split(" ").filter(Boolean)

/** Whether two words are the same name heard two ways. */
function sameWord(a: string, b: string, closeness: number): boolean {
  if (a === b) return true
  // "Rafa" inside "Rafael", "Chris" inside "Christian": one spelling heard shorter than the other
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a]
  if (shorter.length < 4) return false
  if (longer.startsWith(shorter)) return true
  return similarity(a, b) >= closeness
}

/**
 * Whether two names are one person written two ways. **Any part of the name may be the match**,
 * because a transcription hears whichever part was spoken: the app knows the user as "Abdul Rafay"
 * while the meeting called him "Rafa", and a surname is usually mangled past recognition when it
 * appears at all.
 *
 * `closeness` is how sure we have to be: the user's own name is matched more loosely (we already
 * know they were in the meeting, so "Rafa" for "Rafay" is them), two names of other people more
 * strictly, so two real people are never merged into one. 0.75 is what "Cristiana" heard as
 * "Christian" needs (0.78 of the letters, which 0.78 itself misses by a rounding error), while
 * "Mike" and "Muhammad", or "Lucas" and "Emma", are nowhere near it.
 */
export function samePerson(a: string, b: string, closeness = 0.75): boolean {
  const [first, second] = [nameWords(a), nameWords(b)]
  return first.some((word) => second.some((other) => sameWord(word, other, closeness)))
}

/** Whether this is the analysis's own "Unnamed speaker 2" label rather than somebody's name. */
export const isUnnamed = (name: string): boolean => UNNAMED.test(name.trim())

/** Whether a name is close enough to the user's own that it is them under another spelling. */
export const isMe = (name: string, me: string): boolean => samePerson(name, me, 0.6)

/**
 * The people of a meeting, with the spellings of one person folded into one entry.
 *
 * The user is always themselves: every spelling of their name becomes the name the app knows them
 * by, so a task never reads "notify Rafa" about the person reading it. The fullest spelling of
 * anyone else wins, since a name heard twice is usually heard best once.
 */
export function foldParticipants(people: MeetingParticipant[], me: string): MeetingParticipant[] {
  const kept: MeetingParticipant[] = []
  for (const person of people) {
    const name = person.name.trim()
    if (!name) continue
    const asMe = isMe(name, me)
    const at = kept.findIndex((entry) => (asMe ? isMe(entry.name, me) : !isUnnamed(name) && samePerson(entry.name, name)))
    if (at < 0) {
      kept.push({ ...person, name: asMe ? me : name })
      continue
    }
    kept[at] = {
      name: asMe ? me : kept[at].name.length >= name.length ? kept[at].name : name,
      role: kept[at].role ?? person.role ?? null,
      isNamed: kept[at].isNamed || person.isNamed,
      evidence: kept[at].evidence === "stated" || person.evidence === "stated" ? "stated" : "inferred",
    }
  }
  return kept
}

/**
 * The people the user themselves said were in the meeting, as participants. Their word is final:
 * a recording carries no speaker labels, so nothing read out of the transcript can be more certain
 * than this, and every name the transcription invented is dropped.
 */
export const participantsFromPeople = (people: string[]): MeetingParticipant[] =>
  people.map((line) => {
    const { name, role } = readPerson(line)
    return { name, role, isNamed: true, evidence: "stated" }
  })

/**
 * A name as the user typed it, which may say what that person is: "Lucas (client)", "Abdul Rafay
 * (me)". The whole line goes to the model, because knowing who the client is tells a request from
 * an answer, while the report shows the name and the part separately.
 */
export function readPerson(line: string): { name: string; role: string | null } {
  const match = /^(.*?)\s*[(\[]([^)\]]+)[)\]]\s*$/.exec(line.trim())
  if (!match || !match[1].trim()) return { name: line.trim(), role: null }
  const role = match[2].trim()
  // "(me)" says which one is the user, which the app already knows; it is not a part to show
  return { name: match[1].trim(), role: /^(me|myself|i)$/i.test(role) ? null : role }
}

/**
 * Arranging the call is not a decision and not a task: "let's start with the sprint update", "you
 * go first", "connect in ten minutes", "we can record this". A model asked not to record those
 * still does, because they read exactly like an agreement, so they are taken out here where the
 * rule cannot drift from one run to the next.
 */
const ARRANGING_THE_CALL =
  /^(?:(?:let'?s|we (?:can|will|should)|i'?ll)\s+)?(?:start|begin|carry on|go|move)\s+(?:with|on|ahead|first|now)\b|^(?:you|he|she|they)\s+(?:go|goes)\s+first\b|\b(?:re)?connect\s+(?:in|at|again)\b|\bjump\s+in\b|\b(?:record|recording|transcribe|transcription)\s+(?:the|this|it)\b|\bbe\s+\d+\s+minutes?\s+late\b|\bbefore\s+the\s+questionnaire\b|\bthen\s+(?:proceed|move)\s+to\s+the\s+question/i

/** Whether a line is about running the call rather than about the work. */
export const isArrangingTheCall = (text: string): boolean => ARRANGING_THE_CALL.test(text.trim())

/**
 * An owner's name as it should be read: nobody for the analysis's own "Unnamed speaker 1" label,
 * and the known spelling of anyone the meeting really has, so a task says who it belongs to in the
 * name the user knows them by rather than in whatever the transcription heard.
 */
export function ownerAmong(owner: string | null, people: MeetingParticipant[], me: string, known = false): string | null {
  const name = owner?.trim()
  if (!name || isUnnamed(name)) return null
  if (isMe(name, me)) return me
  const match = people.find((person) => samePerson(person.name, name))?.name
  // With the people named by the user, an owner who is not one of them was never in the meeting,
  // so the task is left unowned rather than handed to somebody the transcription invented
  return match ?? (known ? null : name)
}

/** Every task with its owner read the same way, and nothing that is only about running the call. */
export const withKnownOwners = (tasks: ActionItem[], people: MeetingParticipant[], me: string, known = false): ActionItem[] =>
  tasks
    .filter((task) => !isArrangingTheCall(task.task))
    .map((task) => ({ ...task, owner: ownerAmong(task.owner, people, me, known) }))

/** Decisions about the work, with anything that only arranges the call taken out. */
export const workDecisions = <T extends { decision: string }>(decisions: T[]): T[] =>
  decisions.filter((entry) => !isArrangingTheCall(entry.decision))

// Words that carry no subject, so two topics are compared on what they are actually about
const EMPTY_WORDS = new Set(["the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "per", "with", "its", "their"])

// "update" and "updates" are the same subject, so a trailing s is dropped before they are compared
const stem = (word: string): string => (word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word)

const subjectWords = (topic: string): Set<string> =>
  new Set(
    plainName(topic)
      .split(" ")
      .filter((word) => word.length > 1 && !EMPTY_WORDS.has(word))
      .map(stem)
  )

/** How much two topics are about the same thing, 1 for the same words and 0 for nothing shared. */
export function topicOverlap(a: string, b: string): number {
  const [first, second] = [subjectWords(a), subjectWords(b)]
  if (first.size === 0 || second.size === 0) return 0
  const shared = [...first].filter((word) => second.has(word)).length
  // One topic saying everything the other says is the same subject in more words
  if (shared === Math.min(first.size, second.size)) return 1
  return shared / new Set([...first, ...second]).size
}

/**
 * The subjects a meeting covered, each said once. The model writes its own list and the parts add
 * whatever it left out, so the same subject arrives in several wordings ("SSO handling", "single
 * sign-on (SSO) handling", "Upgrade/downgrade process", "upgrade and downgrade process"). They are
 * merged on the words that carry the subject, and the **first** wording is kept, because the model's
 * own list comes first and is in the order the meeting gave them.
 */
export function mergeTopics(topics: string[], max: number): string[] {
  const kept: string[] = []
  for (const topic of topics) {
    const text = topic.trim()
    if (!text) continue
    // Half the words shared is the same subject in practice ("Stripe subscription plans" and
    // "subscription plans list"), while two real subjects of a meeting share far less
    if (kept.some((entry) => topicOverlap(entry, text) >= 0.5)) continue
    kept.push(text)
    if (kept.length >= max) break
  }
  return kept
}
