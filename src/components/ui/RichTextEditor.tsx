"use client"

import React, { useRef, useState, useSyncExternalStore } from "react"
import {
  Bold,
  Code,
  Eye,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pencil,
  Quote,
  SquareCode,
  Strikethrough,
  type LucideIcon,
} from "lucide-react"
import { RichTextView } from "./RichTextView"

interface RichTextEditorProps {
  id: string
  value: string
  onChange: (value: string) => void
  maxLength?: number
  rows?: number
  placeholder?: string
  // A small editor for short texts in a list: the everyday marks only, no Write and Preview tabs
  compact?: boolean
  // Names the field for assistive tech when no visible label points at it
  ariaLabel?: string
}

const COMPACT_TOOLS: ReadonlySet<ToolId> = new Set<ToolId>(["bold", "italic", "bullet", "number", "link"])

type LineStyle = "bullet" | "number" | "check" | "quote" | "h1" | "h2" | "h3"

// What each line style looks like at the start of a line, so a style can be switched off or swapped
const LINE_STYLE: Record<LineStyle, RegExp> = {
  bullet: /^(\s*)[-*+]\s+(?!\[[ xX]\]\s)/,
  number: /^(\s*)\d{1,9}[.)]\s+/,
  check: /^(\s*)[-*+]\s+\[[ xX]\]\s+/,
  quote: /^(\s*)>\s?/,
  h1: /^()#\s+/,
  h2: /^()##\s+/,
  h3: /^()###\s+/,
}
const ANY_LINE_STYLE = /^(\s*)(?:[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d{1,9}[.)]\s+|>\s?|#{1,6}\s+)/
// A list line as Enter sees it: its indent, its marker and what follows the marker
const LIST_LINE = /^(\s*)(?:([-*+])\s+\[[ xX]\]\s+|([-*+])\s+|(\d{1,9})([.)])\s+|(>)\s?)(.*)$/

const prefixFor = (style: LineStyle, indent: string, index: number) =>
  ({
    bullet: `${indent}- `,
    number: `${indent}${index + 1}. `,
    check: `${indent}- [ ] `,
    quote: `${indent}> `,
    h1: "# ",
    h2: "## ",
    h3: "### ",
  })[style]

const subscribeToNothing = () => () => {}
// The server render says "Ctrl"; Apple devices switch to ⌘ once the page is running
const useIsApple = () => useSyncExternalStore(subscribeToNothing, () => /Mac|iPhone|iPad/.test(navigator.userAgent), () => false)

type ToolId =
  | "bold"
  | "italic"
  | "strike"
  | "h1"
  | "h2"
  | "h3"
  | "bullet"
  | "number"
  | "check"
  | "quote"
  | "code"
  | "codeBlock"
  | "link"
  | "divider"

/**
 * A description with formatting: bold, italic, strikethrough, three heading sizes, bullet, numbered
 * and checklist lists, quotes, code, code blocks, links and dividers. The toolbar writes the marks
 * (`lib/richText.ts`) so nobody has to learn them, Preview shows the result, and the text stays
 * plain text, so Copy, search and every description saved before still work as they did.
 *
 * Changes go through the browser's own text insertion where it has one, which keeps Ctrl/⌘+Z
 * working after a toolbar button.
 */
export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  id,
  value,
  onChange,
  maxLength,
  rows = 12,
  placeholder,
  compact = false,
  ariaLabel,
}) => {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [mode, setMode] = useState<"write" | "preview">("write")
  const isApple = useIsApple()
  const shortcut = (key: string) => `${isApple ? "⌘" : "Ctrl+"}${key}`

  /** Replaces a range and then selects [selectFrom, selectTo] in the new text. */
  const replace = (from: number, to: number, text: string, selectFrom: number, selectTo: number) => {
    const element = ref.current
    if (!element) return
    if (maxLength !== undefined && value.length - (to - from) + text.length > maxLength) return
    element.focus()
    element.setSelectionRange(from, to)
    const inserted = text ? document.execCommand("insertText", false, text) : from === to || document.execCommand("delete")
    if (!inserted) onChange(value.slice(0, from) + text + value.slice(to))
    window.requestAnimationFrame(() => element.setSelectionRange(selectFrom, selectTo))
  }

  const selection = () => {
    const element = ref.current
    return { start: element?.selectionStart ?? value.length, end: element?.selectionEnd ?? value.length }
  }

  // The whole lines a selection touches; a selection ending at the very start of a line leaves that line out
  const lineRange = (start: number, end: number) => {
    const last = end > start && value[end - 1] === "\n" ? end - 1 : end
    const lineStart = value.lastIndexOf("\n", start - 1) + 1
    const nextBreak = value.indexOf("\n", last)
    return { lineStart, lineEnd: nextBreak === -1 ? value.length : nextBreak }
  }

  /** Bold, italic, strikethrough and code: wraps the selection, or takes the marks off when they are already there. */
  const toggleWrap = (mark: string, placeholderText: string) => {
    const { start, end } = selection()
    const selected = value.slice(start, end)
    const size = mark.length
    const around = value.slice(start - size, start) === mark && value.slice(end, end + size) === mark
    // A single * next to another * is half of a bold mark, not italic
    const isHalfOfBold = mark === "*" && (value[start - size - 1] === "*" || value[end + size] === "*")

    if (selected.length >= size * 2 && selected.startsWith(mark) && selected.endsWith(mark)) {
      const inner = selected.slice(size, -size)
      replace(start, end, inner, start, start + inner.length)
    } else if (around && !isHalfOfBold) {
      replace(start - size, end + size, selected, start - size, end - size)
    } else if (!selected) {
      replace(start, end, `${mark}${placeholderText}${mark}`, start + size, start + size + placeholderText.length)
    } else {
      replace(start, end, `${mark}${selected}${mark}`, start + size, end + size)
    }
  }

  /** Headings, lists and quotes: applied to every line selected, or removed when they all have it already. */
  const toggleLineStyle = (style: LineStyle) => {
    const { start, end } = selection()
    const { lineStart, lineEnd } = lineRange(start, end)
    const lines = value.slice(lineStart, lineEnd).split("\n")
    const written = lines.filter((line) => line.trim())
    const isOn = written.length > 0 && written.every((line) => LINE_STYLE[style].test(line))

    let counter = 0
    const next = lines
      .map((line) => {
        if (!line.trim() && lines.length > 1) return line
        if (isOn) return line.replace(LINE_STYLE[style], "$1")
        const match = line.match(ANY_LINE_STYLE)
        const indent = match ? match[1] : (line.match(/^\s*/)?.[0] ?? "")
        const content = match ? line.slice(match[0].length) : line.slice(indent.length)
        return `${prefixFor(style, style.startsWith("h") ? "" : indent, counter++)}${content}`
      })
      .join("\n")

    const caretOnly = start === end && lines.length === 1
    replace(lineStart, lineEnd, next, caretOnly ? lineStart + next.length : lineStart, lineStart + next.length)
  }

  const insertCodeBlock = () => {
    const { start, end } = selection()
    if (start === end) {
      const before = start > 0 && value[start - 1] !== "\n" ? "\n" : ""
      replace(start, end, `${before}\`\`\`\n\n\`\`\`\n`, start + before.length + 4, start + before.length + 4)
      return
    }
    const { lineStart, lineEnd } = lineRange(start, end)
    const block = `\`\`\`\n${value.slice(lineStart, lineEnd)}\n\`\`\``
    replace(lineStart, lineEnd, block, lineStart + 4, lineStart + block.length - 4)
  }

  const insertLink = () => {
    const { start, end } = selection()
    const selected = value.slice(start, end)
    const label = selected || "link text"
    const text = `[${label}](https://)`
    // With text selected the address is what is left to type; with nothing selected the label is
    const urlStart = start + label.length + 3
    replace(start, end, text, selected ? urlStart : start + 1, selected ? urlStart + 8 : start + 1 + label.length)
  }

  const insertDivider = () => {
    const { start, end } = selection()
    const before = start > 0 && value[start - 1] !== "\n" ? "\n\n" : ""
    const text = `${before}---\n`
    replace(start, end, text, start + text.length, start + text.length)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = event.metaKey || event.ctrlKey
    if (mod && !event.altKey) {
      const key = event.key.toLowerCase()
      if (key === "b" && !event.shiftKey) {
        event.preventDefault()
        toggleWrap("**", "bold text")
        return
      }
      if (key === "i" && !event.shiftKey) {
        event.preventDefault()
        toggleWrap("*", "italic text")
        return
      }
      if (key === "k" && !event.shiftKey) {
        event.preventDefault()
        insertLink()
        return
      }
      if (key === "x" && event.shiftKey) {
        event.preventDefault()
        toggleWrap("~~", "struck text")
        return
      }
    }

    const { start, end } = selection()
    const { lineStart, lineEnd } = lineRange(start, end)
    const line = value.slice(lineStart, lineEnd)
    const match = line.match(LIST_LINE)

    // Enter carries a list on to the next line, and on an empty item ends the list instead
    if (event.key === "Enter" && !mod && !event.shiftKey && !event.altKey && start === end && match && start === lineEnd) {
      event.preventDefault()
      const [, indent, checkBullet, bullet, number, numberMark, quote, content] = match
      if (!content.trim()) {
        replace(lineStart, lineEnd, "", lineStart, lineStart)
        return
      }
      const marker = checkBullet
        ? `${checkBullet} [ ] `
        : bullet
          ? `${bullet} `
          : number
            ? `${Number(number) + 1}${numberMark} `
            : quote
              ? "> "
              : ""
      const text = `\n${indent}${marker}`
      replace(start, end, text, start + text.length, start + text.length)
      return
    }

    // Tab and Shift+Tab move list lines in and out a level; anywhere else Tab still moves focus
    if (event.key === "Tab" && !mod && !event.altKey) {
      const lines = value.slice(lineStart, lineEnd).split("\n")
      if (!lines.every((entry) => !entry.trim() || LIST_LINE.test(entry))) return
      event.preventDefault()
      const nextLines = lines.map((entry) => (!entry.trim() ? entry : event.shiftKey ? entry.replace(/^ {1,2}/, "") : `  ${entry}`))
      const next = nextLines.join("\n")
      if (start === end) {
        // The caret stays on the same character of its line as the indent moves under it
        const caret = Math.max(lineStart, start + (nextLines[0].length - lines[0].length))
        replace(lineStart, lineEnd, next, caret, caret)
      } else {
        replace(lineStart, lineEnd, next, lineStart, lineStart + next.length)
      }
    }
  }

  // Only what the toolbar draws; what each button does is looked up when it is clicked
  const allTools: { id: ToolId; icon: LucideIcon; label: string; separatorBefore?: boolean }[] = [
    { id: "bold", icon: Bold, label: `Bold (${shortcut("B")})` },
    { id: "italic", icon: Italic, label: `Italic (${shortcut("I")})` },
    { id: "strike", icon: Strikethrough, label: `Strikethrough (${shortcut(isApple ? "⇧X" : "Shift+X")})` },
    { id: "h1", icon: Heading1, label: "Large heading", separatorBefore: true },
    { id: "h2", icon: Heading2, label: "Heading" },
    { id: "h3", icon: Heading3, label: "Small heading" },
    { id: "bullet", icon: List, label: "Bullet list", separatorBefore: true },
    { id: "number", icon: ListOrdered, label: "Numbered list" },
    { id: "check", icon: ListChecks, label: "Checklist" },
    { id: "quote", icon: Quote, label: "Quote", separatorBefore: true },
    { id: "code", icon: Code, label: "Inline code" },
    { id: "codeBlock", icon: SquareCode, label: "Code block" },
    { id: "link", icon: Link2, label: `Link (${shortcut("K")})`, separatorBefore: true },
    { id: "divider", icon: Minus, label: "Divider" },
  ]
  const tools = compact
    ? allTools.filter((tool) => COMPACT_TOOLS.has(tool.id)).map((tool) => ({ ...tool, separatorBefore: tool.id === "bullet" || tool.id === "link" }))
    : allTools

  const runTool = (tool: ToolId) => {
    switch (tool) {
      case "bold":
        return toggleWrap("**", "bold text")
      case "italic":
        return toggleWrap("*", "italic text")
      case "strike":
        return toggleWrap("~~", "struck text")
      case "code":
        return toggleWrap("`", "code")
      case "codeBlock":
        return insertCodeBlock()
      case "link":
        return insertLink()
      case "divider":
        return insertDivider()
      default:
        return toggleLineStyle(tool)
    }
  }

  const modeButton = (target: "write" | "preview", Icon: LucideIcon, label: string) => (
    <button
      type="button"
      onClick={() => setMode(target)}
      aria-pressed={mode === target}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        mode === target ? "bg-white text-on-surface shadow-sm" : "text-on-surface-variant hover:text-on-surface"
      }`}
    >
      <Icon size={13} aria-hidden="true" />
      {label}
    </button>
  )

  return (
    <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
      <div
        className={`flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant bg-surface-container-low ${compact ? "px-1 py-0.5" : "px-2 py-1.5"}`}
      >
        <div role="toolbar" aria-label="Formatting" aria-controls={id} className="flex flex-wrap items-center gap-0.5">
          {tools.map(({ id: toolId, icon: Icon, label, separatorBefore }) => (
            <React.Fragment key={toolId}>
              {separatorBefore && <span className="mx-1 h-5 w-px bg-outline-variant" aria-hidden="true" />}
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runTool(toolId)}
                disabled={mode !== "write"}
                aria-label={label}
                title={label}
                className={`flex ${compact ? "h-7 w-7" : "h-8 w-8"} items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <Icon size={compact ? 14 : 16} aria-hidden="true" />
              </button>
            </React.Fragment>
          ))}
        </div>
        {!compact && (
          <div className="flex rounded-lg bg-surface-container p-0.5">
            {modeButton("write", Pencil, "Write")}
            {modeButton("preview", Eye, "Preview")}
          </div>
        )}
      </div>

      {compact || mode === "write" ? (
        <textarea
          ref={ref}
          id={id}
          value={value}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={rows}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className={`block w-full resize-y border-0 bg-transparent ${compact ? "px-2.5 py-2 font-body-md text-[14px]" : "px-3 py-2.5 font-code text-[13px]"} leading-relaxed text-on-surface placeholder:text-outline focus:outline-none`}
        />
      ) : (
        <div className="custom-scrollbar max-h-[55dvh] min-h-[240px] overflow-y-auto px-4 py-3">
          {value.trim() ? (
            <RichTextView text={value} />
          ) : (
            <p className="text-[13px] text-outline">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  )
}
