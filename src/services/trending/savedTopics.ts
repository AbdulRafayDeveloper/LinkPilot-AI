import { promises as fs } from "node:fs"
import path from "node:path"
import { UserFacingError } from "@/lib/errors"
import { composeTrendingPost } from "@/lib/trendingPost"
import { TRENDING_MESSAGES } from "@/constants/trending"
import { TrendingResultSchema, type TrendingResult } from "./schema"

/**
 * The latest Trending Topics search, shared by everyone who opens the page: one markdown
 * file that each new search replaces and Reset deletes. The top of the file is readable
 * (every topic with its ready-to-post text); the full result sits in a json block at the
 * end, which is what the page loads back. No database is involved. Writes need a writable
 * file system (local development or a server with a persistent disk).
 */
const FILE = path.join(process.cwd(), "src/data/trending-topics/latest.md")
const DATA_BLOCK = /```json\r?\n([\s\S]*)\r?\n```\s*$/
const READ_ONLY_CODES = new Set(["EROFS", "EACCES", "EPERM"])

const errorCode = (error: unknown) => (error as NodeJS.ErrnoException | null)?.code

function toMarkdown(result: TrendingResult): string {
  const { searched_at: searchedAt, search_provider: provider, sources_checked: sources } = result.research_metadata
  const topics = result.topics.map((topic, index) =>
    [
      `## ${index + 1}. ${topic.title}`,
      `${topic.category} · ${topic.freshness} · Discussion potential ${topic.discussion_potential}`,
      composeTrendingPost(topic),
      `Why it's trending. ${topic.why_trending}`,
      `Source. [${topic.primary_reference.title}](${topic.primary_reference.url})`,
    ].join("\n\n")
  )
  // Backticks are escaped so nothing inside the data can close its code fence
  const data = JSON.stringify(result, null, 2).replace(/`/g, "\\u0060")
  return [
    `---\nsearchedAt: ${searchedAt}\ntopics: ${result.topics.length}\n---`,
    "# Trending Topics",
    `Researched ${searchedAt} · ${sources} sources checked · ${provider}`,
    ...(result.notice ? [result.notice] : []),
    ...topics,
    "## Data (the page loads this block, please don't edit it)",
    `\`\`\`json\n${data}\n\`\`\``,
  ].join("\n\n")
}

/**
 * The saved search, or null when nobody has searched since the last Reset. A file that
 * can't be read back as a valid result counts as none.
 */
export async function readSavedTrendingResult(): Promise<TrendingResult | null> {
  let raw: string
  try {
    raw = await fs.readFile(FILE, "utf8")
  } catch (error: unknown) {
    if (errorCode(error) === "ENOENT") return null
    throw error
  }
  const result = parseDataBlock(raw)
  if (!result) console.warn("⚠️ The saved Trending Topics file isn't a valid result; showing none")
  return result
}

function parseDataBlock(raw: string): TrendingResult | null {
  const block = raw.match(DATA_BLOCK)?.[1]
  if (!block) return null
  try {
    const parsed = TrendingResultSchema.safeParse(JSON.parse(block))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/**
 * Replaces the saved search. The file is written next to the old one and then swapped in,
 * so a reader never sees half a file.
 */
export async function saveTrendingResult(result: TrendingResult): Promise<void> {
  const temp = `${FILE}.${process.pid}.tmp`
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true })
    await fs.writeFile(temp, `${toMarkdown(result)}\n`, "utf8")
    await fs.rename(temp, FILE)
  } catch (error: unknown) {
    await fs.rm(temp, { force: true }).catch(() => undefined)
    if (READ_ONLY_CODES.has(errorCode(error) ?? "")) throw new UserFacingError(TRENDING_MESSAGES.readOnly)
    throw error
  }
}

// Removes the saved search for everyone
export async function clearSavedTrendingResult(): Promise<void> {
  try {
    await fs.rm(FILE, { force: true })
  } catch (error: unknown) {
    if (READ_ONLY_CODES.has(errorCode(error) ?? "")) throw new UserFacingError(TRENDING_MESSAGES.readOnly)
    throw error
  }
}
