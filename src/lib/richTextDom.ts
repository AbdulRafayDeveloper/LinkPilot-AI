import { isSafeHref, isSafeImageSrc, parseRichText, type Block, type Inline, type RichList, type RichTable, type TableAlign } from "./richText"

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
 * **A paste keeps its shape, not only its words.** What arrives from a word processor, a web page or
 * an AI chat is rarely written with the tags the toolbar writes, so three things are read as well as
 * the plain ones: a **table** (every cell in its column), emphasis carried by **CSS** rather than by
 * a tag (`font-weight: 700` is what Google Docs and most editors paste bold as, never `<b>`), and
 * **Word's list paragraphs**, which are ordinary paragraphs carrying `mso-list` with the bullet drawn
 * in a span of their own. Without those three a pasted document lost its tables, all of its bold and
 * italic, and every list it had.
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

// Which way a column reads, written as the browser writes it, so a pasted table is read the same way
const alignStyle = (align: TableAlign): Record<string, string> => (align ? { style: `text-align: ${align}` } : {})

function tableTree(table: RichTable): TreeNode {
  const row = (cells: Inline[][], tag: "TH" | "TD") =>
    element(
      "TR",
      cells.map((cell, column) => element(tag, inlineTree(cell), alignStyle(table.align[column] ?? null)))
    )
  return element("TABLE", [element("THEAD", [row(table.header, "TH")]), element("TBODY", table.rows.map((cells) => row(cells, "TD")))])
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
    case "table":
      return tableTree(block.table)
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

/**
 * The emphasis an element carries in its own `style`, which is how a word processor, a web page and
 * most AI editors paste it: Google Docs writes every run as a span with `font-weight: 700` rather
 * than a `<b>`, so without this a pasted document arrives with all of its emphasis gone.
 *
 * Only a weight of 600 or more counts, because the same editors write `font-weight: 400` on
 * **every** span of ordinary text, and that must stay ordinary.
 *
 * **A style can also take emphasis off**, and that matters as much as putting it on: Google Docs
 * wraps a whole copied document in `<b style="font-weight:normal">`, so a reader that trusts the tag
 * and ignores the style makes every word of it bold. So a mark here is true, false, or not mentioned,
 * and only what is not mentioned is left to the tag.
 */
function styledMarks(node: MiniNode): Partial<InlineContext> {
  const style = (attribute(node, "style") ?? "").toLowerCase()
  if (!style) return {}
  const marks: Partial<InlineContext> = {}
  const weight = /font-weight\s*:\s*(bold(?:er)?|lighter|normal|\d{3,})/.exec(style)?.[1]
  if (weight) marks.bold = weight.startsWith("bold") || Number(weight) >= 600
  const slant = /font-style\s*:\s*(italic|oblique|normal)/.exec(style)?.[1]
  if (slant) marks.italic = slant !== "normal"
  const decoration = /text-decoration(?:-line)?\s*:\s*([^;]+)/.exec(style)?.[1]
  if (decoration) marks.strike = decoration.includes("line-through")
  return marks
}

// The emphasis a tag means on its own, which a style on the same element overrules
const TAG_MARKS: Record<string, keyof InlineContext> = {
  STRONG: "bold",
  B: "bold",
  EM: "italic",
  I: "italic",
  S: "strike",
  STRIKE: "strike",
  DEL: "strike",
}

const MARK_TEXT: Record<keyof InlineContext, string> = { bold: "**", italic: "*", strike: "~~" }

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
  // What this element says its words are, from its tag and from its style, the style winning
  if (node.nodeName !== "CODE" && node.nodeName !== "PRE") {
    const marks = styledMarks(node)
    const tagMark = TAG_MARKS[node.nodeName]
    if (tagMark && marks[tagMark] === undefined) marks[tagMark] = true
    // Only a mark this element adds is written here; one it is already inside is left alone
    const adding = (Object.keys(marks) as (keyof InlineContext)[]).filter((mark) => marks[mark] === true && !context[mark])
    if (tagMark || adding.length > 0 || Object.keys(marks).length > 0) {
      let text = inner({ ...marks })
      for (const mark of adding) text = wrap(MARK_TEXT[mark], text)
      return isBlock(node) ? `\n${text}\n` : text
    }
  }
  switch (node.nodeName) {
    case "BR":
      return "\n"
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

/** Every row of a table, however it is wrapped (a thead, a tbody, a tfoot, or none of them). */
function rowsOf(node: MiniNode): MiniNode[] {
  if (node.nodeName === "TR") return [node]
  return childrenOf(node).flatMap((child) => (isElement(child) ? rowsOf(child) : []))
}

const cellsOf = (row: MiniNode) => childrenOf(row).filter((cell) => cell.nodeName === "TD" || cell.nodeName === "TH")

/**
 * Which way a cell's column reads, from the attribute or the style a page or a paste wrote.
 *
 * It looks inside the cell as well, because a word processor writes the alignment on the paragraph
 * it put in the cell rather than on the cell itself.
 */
function cellAlign(cell: MiniNode): TableAlign {
  const way = (node: MiniNode): TableAlign => {
    const named = (attribute(node, "align") ?? "").toLowerCase()
    const styled = /text-align\s*:\s*(left|center|right)/.exec((attribute(node, "style") ?? "").toLowerCase())?.[1]
    const align = styled ?? named
    return align === "left" || align === "center" || align === "right" ? align : null
  }
  if (way(cell)) return way(cell)
  for (const child of childrenOf(cell)) {
    if (isElement(child) && way(child)) return way(child)
  }
  return null
}

/**
 * A table as the rows of pipes the text keeps.
 *
 * Two rules worth knowing. **The first row is the heading**, because a table written as text has to
 * have one: a table whose first row is ordinary cells still reads as a heading above its rows, which
 * is what nearly every pasted table means anyway. And **every row is made as wide as the widest**,
 * so a table stays rectangular; a cell spanning two columns is written once and the columns it
 * covered are left empty, since a table of text cannot join cells.
 */
function tableMarkdown(node: MiniNode, options: Options): string[] {
  const rows = rowsOf(node).map((row) => cellsOf(row))
  if (rows.length === 0) return []
  const width = Math.max(...rows.map((cells) => cells.length))
  if (width === 0) return []
  // The first row that says which way this column reads: a short row has no cell there at all, and
  // a word processor writes the alignment on the cells rather than on the heading
  const align: TableAlign[] = Array.from({ length: width }, (_, column) => {
    for (const cells of rows) {
      const way = cells[column] ? cellAlign(cells[column]) : null
      if (way) return way
    }
    return null
  })
  const text = (cells: MiniNode[]) =>
    `| ${Array.from({ length: width }, (_, column) => {
      const cell = cells[column]
      // A pipe inside a cell would read as the next column, so it is written as text
      return cell ? oneLine(inlineMarkdown(childrenOf(cell), options, { bold: false, italic: false, strike: false })).replace(/\|/g, "\\|") : ""
    }).join(" | ")} |`
  const rule = `| ${align.map((way) => (way === "center" ? ":---:" : way === "right" ? "---:" : way === "left" ? ":---" : "---")).join(" | ")} |`
  const lines = [text(rows[0]), rule, ...rows.slice(1).map(text)]
  // A table with nothing in it at all is not worth keeping
  return lines.some((line) => line.replace(/[|\s-]/g, "")) ? [lines.join("\n")] : []
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
    case "TABLE":
      return tableMarkdown(node, options)
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

/**
 * The bullet or the number a word processor drew itself, at the start of what is otherwise plain
 * text: Word puts it in a span of its own inside the paragraph, so it arrives as the paragraph's
 * first words rather than as a list marker.
 *
 * Two rules, not one. A **number or a letter** has to carry its dot or bracket (`1.`, `a)`), which
 * is what tells a marker from the words. A **glyph** needs nothing after it, because no word starts
 * with one; but the glyphs that are also ordinary characters (`o`, which is Word's second level,
 * and a dash) have to be followed by a space, or the "o" would be eaten off "office" and the minus
 * off a negative number.
 */
const DRAWN_NUMBER = /^\s*(?:\d{1,9}|[a-z]|[ivxlcdm]{1,6})[.)]\s*/i
const DRAWN_BULLET = /^\s*(?:[•·▪◦‣⁃○●■□§]\s*|[o*–—-]\s+)/i

/**
 * One of Word's list paragraphs: an ordinary `<p>` carrying `mso-list` in its style, with the level
 * it sits at. Without this a pasted Word list arrives as a column of paragraphs each starting with a
 * bullet character, which is neither a list to read nor one to edit.
 */
function wordListItem(node: MiniNode, options: Options): { depth: number; ordered: boolean; text: string } | null {
  if (node.nodeName !== "P" && node.nodeName !== "DIV") return null
  const style = (attribute(node, "style") ?? "").toLowerCase()
  // Word writes `mso-list: none` on the paragraphs that are **not** list items, so the word alone
  // is not the test: there has to be a list and a level on it
  const level = /mso-list\s*:\s*[^;]*\blevel(\d)/.exec(style)?.[1]
  if (!level) return null
  const words = oneLine(inlineMarkdown(childrenOf(node), options, { bold: false, italic: false, strike: false }))
  const numbered = DRAWN_NUMBER.exec(words)
  const marker = numbered ?? DRAWN_BULLET.exec(words)
  const text = marker ? words.slice(marker[0].length) : words
  if (!text.trim()) return null
  return {
    depth: Math.max(0, Number(level ?? 1) - 1),
    // A number or a letter with its dot was a numbered list; a glyph was not
    ordered: Boolean(numbered),
    text: text.replace(/^\[/, "\\["),
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
  // One run of Word's list paragraphs is one list, so the lines are gathered before they are written
  let wordList: { depth: number; ordered: boolean; text: string }[] = []
  const flushWordList = () => {
    if (wordList.length === 0) return
    let number = 1
    blocks.push(
      wordList
        .map((item, position) => {
          const above = wordList[position - 1]
          if (!above || above.depth !== item.depth) number = 1
          return `${"  ".repeat(item.depth)}${item.ordered ? `${number++}. ` : "- "}${item.text}`
        })
        .join("\n")
    )
    wordList = []
  }

  for (const node of nodes) {
    if (isElement(node) && (SKIPPED_TAGS.has(node.nodeName) || attribute(node, CHECKBOX_ATTRIBUTE) !== null)) continue
    // The newline between two tags in a pasted document is a text node of nothing. It must not end
    // the run of list items it sits between, or a pasted list becomes one list per item
    if (node.nodeType === TEXT_NODE && !(node.textContent ?? "").trim() && run.length === 0) continue
    // A span, a font or even a <b> wrapped around whole blocks is a wrapper, not a run of words:
    // Google Docs wraps everything it copies in one, and reading it as words flattens the document
    if (isElement(node) && !isBlock(node) && node.nodeName !== "IMG" && childrenOf(node).some((child) => isBlock(child) || child.nodeName === "IMG")) {
      flush()
      flushWordList()
      blocks.push(...blocksMarkdown(childrenOf(node), options))
      continue
    }
    const listed = isElement(node) ? wordListItem(node, options) : null
    if (listed) {
      flush()
      wordList.push(listed)
      continue
    }
    flushWordList()
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
  flushWordList()
  return blocks
}

/** What a page of formatted text holds, as the saved text: one blank line between blocks. */
export function toMarkdown(root: MiniNode, options: Options = {}): string {
  return blocksMarkdown(childrenOf(root), options).join("\n\n")
}
