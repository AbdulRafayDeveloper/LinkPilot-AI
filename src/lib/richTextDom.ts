import { isSafeHref, isSafeImageSrc, parseRichText, type Block, type Inline, type RichList } from "./richText"

/**
 * The bridge between the visual editor (a contenteditable page of formatted text) and the Markdown
 * subset every description is saved as (lib/richText.ts). Two directions:
 *
 * - `toTree` turns saved text into a small tree of elements the editor draws, the same elements the
 *   viewer shows, so what is edited looks like what is read.
 * - `toMarkdown` reads whatever the page holds back into that text: what the toolbar made, what the
 *   browser made when Enter was pressed, and what was pasted from another site. Anything it does not
 *   know is kept as its words, so no markup, style or script from a paste can reach a description.
 *
 * Both work on `MiniNode`, the few parts of a DOM node they need, so a real page and the plain objects
 * `toTree` builds are read the same way and the round trip can be tested without a browser.
 */

export interface MiniNode {
  nodeType: number
  nodeName: string
  childNodes: ArrayLike<MiniNode>
  textContent: string | null
  getAttribute?: (name: string) => string | null
}

const TEXT_NODE = 3
const ELEMENT_NODE = 1

// Marks the editor adds for itself and that are never part of the text: a checklist item's box
export const CHECKBOX_ATTRIBUTE = "data-checkbox"
export const CHECKLIST_ATTRIBUTE = "data-checklist"
export const CHECKED_ATTRIBUTE = "data-checked"

const BLOCK_TAGS = new Set([
  "P",
  "DIV",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "UL",
  "OL",
  "LI",
  "BLOCKQUOTE",
  "PRE",
  "HR",
  "FIGURE",
  "SECTION",
  "ARTICLE",
  "HEADER",
  "FOOTER",
  "MAIN",
  "ASIDE",
  "NAV",
  "TABLE",
  "THEAD",
  "TBODY",
  "TR",
  "DL",
  "DT",
  "DD",
])
const SKIPPED_TAGS = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT", "IFRAME", "OBJECT", "SVG", "HEAD", "TITLE", "META", "LINK"])

const attribute = (node: MiniNode, name: string) => node.getAttribute?.(name) ?? null
const childrenOf = (node: MiniNode) => Array.from(node.childNodes)
const isElement = (node: MiniNode) => node.nodeType === ELEMENT_NODE
const isBlock = (node: MiniNode) => isElement(node) && BLOCK_TAGS.has(node.nodeName)

/* ------------------------------------------------------------------ text to tree */

/** One node of the tree `toTree` builds: an element with attributes, or a run of text. */
export class TreeNode implements MiniNode {
  readonly childNodes: TreeNode[]
  constructor(
    readonly nodeType: number,
    readonly nodeName: string,
    readonly attributes: Record<string, string> = {},
    children: TreeNode[] = [],
    private readonly text = ""
  ) {
    this.childNodes = children
  }

  get textContent(): string {
    return this.nodeType === TEXT_NODE ? this.text : this.childNodes.map((child) => child.textContent).join("")
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null
  }
}

const element = (tag: string, children: TreeNode[] = [], attributes: Record<string, string> = {}) => new TreeNode(ELEMENT_NODE, tag, attributes, children)
const textNode = (text: string) => new TreeNode(TEXT_NODE, "#text", {}, [], text)

function inlineTree(nodes: Inline[]): TreeNode[] {
  return nodes.map((node) => {
    switch (node.kind) {
      case "text":
        return textNode(node.text)
      case "bold":
        return element("STRONG", inlineTree(node.children))
      case "italic":
        return element("EM", inlineTree(node.children))
      case "strike":
        return element("S", inlineTree(node.children))
      case "code":
        return element("CODE", [textNode(node.text)])
      case "link":
        return isSafeHref(node.href) ? element("A", inlineTree(node.children), { href: node.href }) : element("SPAN", inlineTree(node.children))
    }
  })
}

// Lines of a paragraph or a quote, with a line break between them
const linesTree = (lines: Inline[][]) => lines.flatMap((line, index) => [...(index > 0 ? [element("BR")] : []), ...inlineTree(line)])

function listTree(list: RichList): TreeNode {
  const isChecklist = list.items.length > 0 && list.items.every((item) => item.checked !== null)
  const attributes: Record<string, string> = {}
  if (list.ordered && list.start !== 1) attributes.start = String(list.start)
  if (isChecklist) attributes[CHECKLIST_ATTRIBUTE] = "true"
  const items = list.items.map((item) =>
    element("LI", [...inlineTree(item.children), ...(item.sublist ? [listTree(item.sublist)] : [])], isChecklist ? { [CHECKED_ATTRIBUTE]: String(Boolean(item.checked)) } : {})
  )
  return element(list.ordered ? "OL" : "UL", items, attributes)
}

function blockTree(block: Block): TreeNode {
  switch (block.kind) {
    case "heading":
      return element(`H${block.level}`, inlineTree(block.children))
    case "paragraph":
      return element("P", linesTree(block.lines))
    case "quote":
      return element("BLOCKQUOTE", linesTree(block.lines))
    case "list":
      return listTree(block.list)
    case "code":
      return element("PRE", [element("CODE", [textNode(block.text)])])
    case "divider":
      return element("HR")
    case "image":
      return element("IMG", [], { src: block.src, alt: block.alt })
  }
}

/** Saved text as the elements the visual editor draws, one per block. */
export function toTree(text: string): TreeNode[] {
  return parseRichText(text).map(blockTree)
}

/* ------------------------------------------------------------------ page to text */

// Characters that would start formatting if left as they are; a backslash keeps each one as text
function escapeText(text: string): string {
  return text
    .replace(/\\(?=[\\`*_~[\]()#>+\-.!|{}])/g, "\\\\")
    .replace(/[*`]/g, "\\$&")
    .replace(/~~/g, "\\~\\~")
    .replace(/\[(?=[^\]\n]*\]\()/g, "\\[")
}

// What would make a line a heading, a list, a quote, a code fence or a divider when it is only text
function escapeLineStart(line: string): string {
  return line
    .replace(/^(#{1,6})(?=\s)/, "\\$1")
    .replace(/^([-+])(?=\s)/, "\\$1")
    .replace(/^(\d{1,9})([.)])(?=\s)/, "$1\\$2")
    .replace(/^>/, "\\>")
    .replace(/^(-{3,}|_{3,})(\s*)$/, "\\$1$2")
}

// An image found inside a line of text goes on a line of its own; this marks it so it isn't escaped
const IMAGE_MARK = "\u0001"

interface Options {
  // The page's own address, taken off image sources the browser wrote out in full
  origin?: string
}

function imageSource(node: MiniNode, options: Options): string | null {
  let src = (attribute(node, "src") ?? "").trim()
  if (options.origin && src.startsWith(options.origin)) src = src.slice(options.origin.length)
  return isSafeImageSrc(src) ? src : null
}

function imageMarkdown(node: MiniNode, options: Options): string | null {
  const src = imageSource(node, options)
  if (!src) return null
  const alt = (attribute(node, "alt") ?? "").replace(/[\]\n\r]/g, " ").trim()
  return `![${alt}](${src})`
}

// Marks around text, kept off the spaces at its ends so the marks still read as formatting
function wrap(mark: string, inner: string): string {
  return inner
    .split("\n")
    .map((segment) => {
      const core = segment.trim()
      if (!core) return segment
      const before = segment.slice(0, segment.indexOf(core))
      const after = segment.slice(before.length + core.length)
      return `${before}${mark}${core}${mark}${after}`
    })
    .join("\n")
}

interface InlineContext {
  bold: boolean
  italic: boolean
  strike: boolean
}

function inlineMarkdown(nodes: MiniNode[], options: Options, context: InlineContext): string {
  return nodes.map((node) => inlineNode(node, options, context)).join("")
}

function inlineNode(node: MiniNode, options: Options, context: InlineContext): string {
  if (node.nodeType === TEXT_NODE) {
    // No-break spaces are how an editor keeps typed spaces; a zero-width one marks where a code span ends
    const text = (node.textContent ?? "").replace(/​/g, "").replace(/ /g, " ").replace(/[ \t\r\n\f]+/g, " ")
    return escapeText(text)
  }
  if (!isElement(node) || SKIPPED_TAGS.has(node.nodeName) || attribute(node, CHECKBOX_ATTRIBUTE) !== null) return ""
  const inner = (next: Partial<InlineContext> = {}) => inlineMarkdown(childrenOf(node), options, { ...context, ...next })
  switch (node.nodeName) {
    case "BR":
      return "\n"
    case "STRONG":
    case "B":
      return context.bold ? inner() : wrap("**", inner({ bold: true }))
    case "EM":
    case "I":
      return context.italic ? inner() : wrap("*", inner({ italic: true }))
    case "S":
    case "STRIKE":
    case "DEL":
      return context.strike ? inner() : wrap("~~", inner({ strike: true }))
    case "CODE": {
      const code = (node.textContent ?? "").replace(/`/g, "'").replace(/\s+/g, " ")
      return code.trim() ? `\`${code}\`` : code
    }
    case "A": {
      const href = (attribute(node, "href") ?? "").trim().replace(/\s/g, "%20").replace(/\)/g, "%29")
      const label = inner()
      if (!isSafeHref(href) || !label.trim()) return label
      // A link whose words are its own address reads best as the address alone
      return label.trim() === escapeText(href) ? href : `[${label.replace(/\n/g, " ")}](${href})`
    }
    case "IMG": {
      const image = imageMarkdown(node, options)
      return image ? `\n${IMAGE_MARK}${image}\n` : ""
    }
    default:
      // Anything else (a span, a font, a block element inside a line) keeps its words
      return isBlock(node) ? `\n${inner()}\n` : inner()
  }
}

// A paragraph's text as its lines: trimmed, escaped where a line would otherwise start formatting
function paragraph(markdown: string): string {
  const lines = markdown
    .split("\n")
    .map((line) => (line.startsWith(IMAGE_MARK) ? line.slice(1).trim() : escapeLineStart(line.trim())))
  while (lines.length > 0 && !lines[0]) lines.shift()
  while (lines.length > 0 && !lines[lines.length - 1]) lines.pop()
  // A blank line inside would split the paragraph; kept as one blank line, which is what it shows
  return lines.join("\n").replace(/\n{3,}/g, "\n\n")
}

const oneLine = (markdown: string) => markdown.replace(/\u0001/g, "").replace(/\s*\n\s*/g, " ").trim()

function listLines(list: MiniNode, depth: number, options: Options): string[] {
  const ordered = list.nodeName === "OL"
  const isChecklist = attribute(list, CHECKLIST_ATTRIBUTE) !== null
  let number = Number.parseInt(attribute(list, "start") ?? "1", 10) || 1
  const lines: string[] = []
  for (const child of childrenOf(list)) {
    if (child.nodeName === "UL" || child.nodeName === "OL") {
      // Some browsers put a nested list beside the items rather than inside one
      lines.push(...listLines(child, depth + 1, options))
      continue
    }
    if (child.nodeName !== "LI") {
      const stray = oneLine(inlineNode(child, options, { bold: false, italic: false, strike: false }))
      if (stray) lines.push(`${"  ".repeat(depth)}- ${stray}`)
      continue
    }
    const parts = childrenOf(child)
    const words = oneLine(inlineMarkdown(parts.filter((part) => part.nodeName !== "UL" && part.nodeName !== "OL"), options, { bold: false, italic: false, strike: false }))
    const nested = parts.filter((part) => part.nodeName === "UL" || part.nodeName === "OL")
    if (words) {
      const checked = attribute(child, CHECKED_ATTRIBUTE) === "true"
      const marker = ordered ? `${number}. ` : isChecklist ? `- [${checked ? "x" : " "}] ` : "- "
      // An item that starts with "[ ]" as its own words would otherwise turn into a checklist item
      lines.push(`${"  ".repeat(depth)}${marker}${words.replace(/^\[/, "\\[")}`)
      number++
    }
    for (const sublist of nested) lines.push(...listLines(sublist, depth + 1, options))
  }
  return lines
}

function blockMarkdown(node: MiniNode, options: Options): string[] {
  const inline = () => inlineMarkdown(childrenOf(node), options, { bold: false, italic: false, strike: false })
  switch (node.nodeName) {
    case "H1":
    case "H2":
    case "H3":
    case "H4":
    case "H5":
    case "H6": {
      const words = oneLine(inline())
      return words ? [`${"#".repeat(Math.min(Number(node.nodeName[1]), 3))} ${words}`] : []
    }
    case "UL":
    case "OL": {
      const lines = listLines(node, 0, options)
      return lines.length > 0 ? [lines.join("\n")] : []
    }
    case "BLOCKQUOTE": {
      const inner = blocksMarkdown(childrenOf(node), options).join("\n")
      return inner.trim() ? [inner.split("\n").map((line) => `> ${line}`.trimEnd()).join("\n")] : []
    }
    case "PRE": {
      const code = (node.textContent ?? "").replace(/ /g, " ").replace(/\n+$/, "")
      return code.trim() ? [`\`\`\`\n${code.replace(/```/g, "'''")}\n\`\`\``] : []
    }
    case "HR":
      return ["---"]
    case "LI": {
      const words = oneLine(inline())
      return words ? [`- ${words}`] : []
    }
    default: {
      // A container (a div, a section, a table): its own blocks when it has any, else one paragraph
      const children = childrenOf(node)
      if (children.some((child) => isBlock(child) || child.nodeName === "IMG")) return blocksMarkdown(children, options)
      const text = paragraph(inline())
      return text ? [text] : []
    }
  }
}

function blocksMarkdown(nodes: MiniNode[], options: Options): string[] {
  const blocks: string[] = []
  let run: MiniNode[] = []
  const flush = () => {
    const text = paragraph(inlineMarkdown(run, options, { bold: false, italic: false, strike: false }))
    if (text) blocks.push(text)
    run = []
  }
  for (const node of nodes) {
    if (isElement(node) && (SKIPPED_TAGS.has(node.nodeName) || attribute(node, CHECKBOX_ATTRIBUTE) !== null)) continue
    if (node.nodeName === "IMG") {
      flush()
      const image = imageMarkdown(node, options)
      if (image) blocks.push(image)
    } else if (isBlock(node)) {
      flush()
      blocks.push(...blockMarkdown(node, options))
    } else {
      run.push(node)
    }
  }
  flush()
  return blocks
}

/** What a page of formatted text holds, as the saved text: one blank line between blocks. */
export function toMarkdown(root: MiniNode, options: Options = {}): string {
  return blocksMarkdown(childrenOf(root), options).join("\n\n")
}
