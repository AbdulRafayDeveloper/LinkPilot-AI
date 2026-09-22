/**
 * Formatted text kept as plain text: a small, predictable Markdown subset that the editor's
 * toolbar writes and the viewer reads. Plain text stays plain text (every description saved
 * before formatting existed reads exactly as it did), and nothing here ever produces HTML, so a
 * saved description can never inject markup into the page.
 *
 * Blocks: # / ## / ### headings (#### and deeper read as the smallest), - * + bullets, 1. numbered
 * items, - [ ] / - [x] checklists (indent two spaces per level to nest), > quotes, ``` code blocks,
 * --- dividers and images, an ![alt](src) on a line of its own.
 * Inline: **bold**, *italic*, ***both***, ~~strikethrough~~, `code`, [text](https://link) and bare
 * links. A backslash keeps the character after it as it is (\* is a star, not italic), which is how
 * the visual editor writes a star or a # the user typed as text.
 */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold" | "italic" | "strike"; children: Inline[] }
  | { kind: "code"; text: string }
  | { kind: "link"; href: string; children: Inline[] }

export interface RichList {
  ordered: boolean
  start: number
  items: RichListItem[]
}

export interface RichListItem {
  children: Inline[]
  // null for an ordinary item, true or false for a checklist item
  checked: boolean | null
  sublist: RichList | null
}

export type Block =
  | { kind: "heading"; level: 1 | 2 | 3; children: Inline[] }
  | { kind: "paragraph"; lines: Inline[][] }
  | { kind: "quote"; lines: Inline[][] }
  | { kind: "list"; list: RichList }
  | { kind: "code"; text: string }
  | { kind: "divider" }
  | { kind: "image"; src: string; alt: string }

const FENCE = /^\s*```/
const DIVIDER = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/
const HEADING = /^(#{1,6})\s+(.*)$/
const QUOTE = /^\s*>\s?(.*)$/
const LIST_ITEM = /^(\s*)(?:([-*+])|(\d{1,9})[.)])\s+(?:\[([ xX])\]\s+)?(.*)$/
const IMAGE = /^\s*!\[([^\]\n]*)\]\(([^\s)]+)\)\s*$/

// Only links that open a page or an email; anything else ("javascript:") stays plain text
const SAFE_HREF = /^(?:https?:\/\/|mailto:)/i

/**
 * Where an image may come from: an https address, or an image stored with Important Content or a Quick Note,
 * which is only ever served by the app's own route (lib/storedImages.ts). Anything else stays text.
 */
const SAFE_IMAGE_SRC = /^(?:https:\/\/[^\s"'<>]+|\/api\/(?:important-content|quick-notes)\/images\/[0-9a-f]{24}\/[0-9a-f]{24}\.(?:png|jpg|webp))$/i

// One pass over a line: escapes, code (its contents are never formatted), links, then emphasis
const INLINE =
  /\\([\\`*_~[\]()#>+\-.!|{}])|`([^`\n]+)`|\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)|\*\*\*(?!\s)(.+?)(?<!\s)\*\*\*|\*\*(?!\s)(.+?)(?<!\s)\*\*|~~(?!\s)(.+?)(?<!\s)~~|\*(?![\s*])(.+?)(?<![\s*])\*|(https?:\/\/[^\s<>]*[^\s<>.,;:!?)\]'"])/g

export function parseInline(line: string): Inline[] {
  const nodes: Inline[] = []
  let last = 0
  // Escaped characters and the text around them read as one run of text
  const pushText = (text: string) => {
    const previous = nodes[nodes.length - 1]
    if (previous?.kind === "text") previous.text += text
    else nodes.push({ kind: "text", text })
  }
  for (const match of line.matchAll(INLINE)) {
    const index = match.index ?? 0
    if (index > last) pushText(line.slice(last, index))
    const [whole, escaped, code, linkText, linkHref, boldItalic, bold, strike, italic, bareUrl] = match
    if (escaped !== undefined) pushText(escaped)
    else if (code !== undefined) nodes.push({ kind: "code", text: code })
    else if (linkText !== undefined && linkHref !== undefined) nodes.push({ kind: "link", href: linkHref, children: parseInline(linkText) })
    else if (boldItalic !== undefined) nodes.push({ kind: "bold", children: [{ kind: "italic", children: parseInline(boldItalic) }] })
    else if (bold !== undefined) nodes.push({ kind: "bold", children: parseInline(bold) })
    else if (strike !== undefined) nodes.push({ kind: "strike", children: parseInline(strike) })
    else if (italic !== undefined) nodes.push({ kind: "italic", children: parseInline(italic) })
    else if (bareUrl !== undefined) nodes.push({ kind: "link", href: bareUrl, children: [{ kind: "text", text: bareUrl }] })
    else pushText(whole)
    last = index + whole.length
  }
  if (last < line.length) pushText(line.slice(last))
  return nodes
}

export const isSafeHref = (href: string) => SAFE_HREF.test(href)
export const isSafeImageSrc = (src: string) => SAFE_IMAGE_SRC.test(src)

/** An image line, when the line is one and its source is one the page may show. */
function readImageLine(line: string): { src: string; alt: string } | null {
  const match = line.match(IMAGE)
  return match && isSafeImageSrc(match[2]) ? { alt: match[1], src: match[2] } : null
}

interface ListLine {
  depth: number
  ordered: boolean
  number: number
  checked: boolean | null
  content: string
}

function readListLine(line: string): ListLine | null {
  const match = line.match(LIST_ITEM)
  if (!match) return null
  const [, indent, bullet, number, check, content] = match
  const spaces = indent.replace(/\t/g, "  ").length
  return {
    depth: Math.floor(spaces / 2),
    ordered: bullet === undefined,
    number: number ? Number(number) : 1,
    checked: check === undefined ? null : check.toLowerCase() === "x",
    content,
  }
}

/**
 * Consecutive list lines as nested lists. A deeper line belongs to the item above it; a line of the
 * other kind (a number after bullets) at the same depth starts a list of its own.
 */
function buildList(lines: ListLine[], start: number, depth: number): { list: RichList; next: number } {
  const first = lines[start]
  const list: RichList = { ordered: first.ordered, start: first.number, items: [] }
  let index = start
  while (index < lines.length) {
    const line = lines[index]
    const lineDepth = list.items.length === 0 ? depth : line.depth
    if (lineDepth < depth) break
    if (lineDepth > depth) {
      const parent = list.items[list.items.length - 1]
      const nested = buildList(lines, index, lineDepth)
      parent.sublist = nested.list
      index = nested.next
      continue
    }
    if (line.ordered !== list.ordered) break
    list.items.push({ children: parseInline(line.content), checked: line.checked, sublist: null })
    index++
  }
  return { list, next: index }
}

export function parseRichText(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n")
  const blocks: Block[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (!line.trim()) {
      index++
      continue
    }

    if (FENCE.test(line)) {
      const body: string[] = []
      index++
      while (index < lines.length && !FENCE.test(lines[index])) body.push(lines[index++])
      index++ // the closing fence, when there is one
      blocks.push({ kind: "code", text: body.join("\n") })
      continue
    }

    if (DIVIDER.test(line)) {
      blocks.push({ kind: "divider" })
      index++
      continue
    }

    const image = readImageLine(line)
    if (image) {
      blocks.push({ kind: "image", ...image })
      index++
      continue
    }

    const heading = line.match(HEADING)
    if (heading) {
      blocks.push({ kind: "heading", level: Math.min(heading[1].length, 3) as 1 | 2 | 3, children: parseInline(heading[2]) })
      index++
      continue
    }

    if (QUOTE.test(line)) {
      const quoted: Inline[][] = []
      while (index < lines.length && QUOTE.test(lines[index])) quoted.push(parseInline(lines[index++].match(QUOTE)?.[1] ?? ""))
      blocks.push({ kind: "quote", lines: quoted })
      continue
    }

    if (readListLine(line)) {
      const listLines: ListLine[] = []
      while (index < lines.length) {
        const item = readListLine(lines[index])
        if (!item) break
        listLines.push(item)
        index++
      }
      for (let position = 0; position < listLines.length; ) {
        const { list, next } = buildList(listLines, position, 0)
        blocks.push({ kind: "list", list })
        position = next
      }
      continue
    }

    const paragraph: Inline[][] = []
    while (
      index < lines.length &&
      lines[index].trim() &&
      !FENCE.test(lines[index]) &&
      !DIVIDER.test(lines[index]) &&
      !HEADING.test(lines[index]) &&
      !QUOTE.test(lines[index]) &&
      !readListLine(lines[index]) &&
      !readImageLine(lines[index])
    ) {
      paragraph.push(parseInline(lines[index++]))
    }
    blocks.push({ kind: "paragraph", lines: paragraph })
  }

  return blocks
}

const inlineText = (nodes: Inline[]): string =>
  nodes.map((node) => (node.kind === "text" || node.kind === "code" ? node.text : inlineText(node.children))).join("")

function listText(list: RichList, depth: number): string[] {
  return list.items.flatMap((item, position) => {
    const marker = item.checked !== null ? (item.checked ? "☑" : "☐") : list.ordered ? `${list.start + position}.` : "•"
    const line = `${"  ".repeat(depth)}${marker} ${inlineText(item.children)}`
    return item.sublist ? [line, ...listText(item.sublist, depth + 1)] : [line]
  })
}

/**
 * The text as it reads with the formatting marks taken out, for places that show a short
 * preview (a table cell) rather than the formatted text.
 */
export function toPlainText(text: string): string {
  return parseRichText(text)
    .flatMap((block) => {
      switch (block.kind) {
        case "heading":
          return [inlineText(block.children)]
        case "paragraph":
        case "quote":
          return block.lines.map(inlineText)
        case "list":
          return listText(block.list, 0)
        case "code":
          return [block.text]
        case "divider":
        case "image":
          return []
      }
    })
    .join("\n")
}
