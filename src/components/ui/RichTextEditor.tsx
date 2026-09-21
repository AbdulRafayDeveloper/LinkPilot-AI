"use client"

import React, { useRef, useState, useSyncExternalStore } from "react"
import {
  AArrowDown,
  AArrowUp,
  Bold,
  Code,
  Eye,
  FileCode2,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Loader2,
  Minus,
  Pencil,
  Quote,
  SquareCode,
  Strikethrough,
  Type,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react"
import { RichTextView } from "./RichTextView"
import { VisualEditor, type VisualEditorHandle } from "./VisualEditor"

/** Adding pictures: where the file goes, and what to say when one can't be used. */
export interface RichTextImages {
  accept: string
  maxBytes: number
  // Stores one picture and answers the address the text names it by
  upload: (file: File) => Promise<string>
  messages: { unsupported: string; tooLarge: string; failed: string; badAddress: string }
}

/** The size the text is written and read at, chosen from a few steps with A− and A+. */
export interface RichTextSize {
  value: number
  steps: readonly number[]
  onChange: (size: number) => void
}

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
  // Opens on a visual page that shows the formatting instead of the marks, with a Markdown tab beside it
  visual?: boolean
  images?: RichTextImages
  textSize?: RichTextSize
  // Grows to fill the space its parent gives it (a tall dialog), rather than a fixed number of rows
  fill?: boolean
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
  visual = false,
  images,
  textSize,
  fill = false,
}) => {
  const ref = useRef<HTMLTextAreaElement>(null)
  const visualRef = useRef<VisualEditorHandle>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // "visual" is the formatted page, "write" the Markdown text, "preview" the text shown formatted
  const [mode, setMode] = useState<"visual" | "write" | "preview">(visual ? "visual" : "write")
  // The address bar under the toolbar, for a link or an image, and what it has to say
  const [bar, setBar] = useState<{ kind: "link" | "image"; address: string } | null>(null)
  const [imageStatus, setImageStatus] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null })
  const isApple = useIsApple()
  const shortcut = (key: string) => `${isApple ? "⌘" : "Ctrl+"}${key}`
  const fontSize = textSize?.value

  /** Opens the address bar, keeping where the caret was so the link or image lands there. */
  const openBar = (kind: "link" | "image") => {
    visualRef.current?.keepSelection()
    setImageStatus({ busy: false, error: null })
    setBar({ kind, address: "" })
  }

  // An image line in the Markdown text, on a line of its own at the caret
  const insertImageLine = (src: string) => {
    const { start, end } = selection()
    const before = start > 0 && value[start - 1] !== "\n" ? "\n" : ""
    const text = `${before}![](${src})\n`
    replace(start, end, text, start + text.length, start + text.length)
  }

  const placeImage = (src: string) => (mode === "visual" ? visualRef.current?.insertImage(src) : insertImageLine(src))

  /** Checks, stores and places each picture in turn; one that can't be used says why and the rest carry on. */
  const addImageFiles = async (files: File[]) => {
    if (!images) return
    const accepted = images.accept.split(",")
    setImageStatus({ busy: true, error: null })
    let problem: string | null = null
    for (const file of files) {
      if (!accepted.includes(file.type)) {
        problem = images.messages.unsupported
        continue
      }
      if (file.size > images.maxBytes) {
        problem = images.messages.tooLarge
        continue
      }
      try {
        placeImage(await images.upload(file))
      } catch (reason: unknown) {
        problem = reason instanceof Error ? reason.message : images.messages.failed
      }
    }
    setImageStatus({ busy: false, error: problem })
    if (!problem) setBar(null)
  }

  const applyAddress = () => {
    if (!bar) return
    const address = bar.address.trim()
    if (bar.kind === "image") {
      if (!/^https:\/\/\S+$/i.test(address) || !images) {
        setImageStatus({ busy: false, error: images?.messages.badAddress ?? null })
        return
      }
      placeImage(address)
    } else {
      const href = /^(?:https?:\/\/|mailto:)/i.test(address) ? address : `https://${address}`
      if (!address || /\s/.test(address)) return
      visualRef.current?.insertLink(href)
    }
    setBar(null)
  }

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
    if (mode === "visual") {
      if (tool === "link") openBar("link")
      else visualRef.current?.run(tool)
      return
    }
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

  const modeButton = (target: "visual" | "write" | "preview", Icon: LucideIcon, label: string) => (
    <button
      type="button"
      onClick={() => {
        setMode(target)
        setBar(null)
      }}
      aria-pressed={mode === target}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        mode === target ? "bg-white text-on-surface shadow-sm" : "text-on-surface-variant hover:text-on-surface"
      }`}
    >
      <Icon size={13} aria-hidden="true" />
      {label}
    </button>
  )

  const toolButton = "flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-40"
  const canFormat = mode !== "preview"
  const sizeIndex = textSize ? textSize.steps.indexOf(textSize.value) : -1
  const stepSize = (by: number) => {
    if (!textSize) return
    const next = textSize.steps[Math.min(textSize.steps.length - 1, Math.max(0, (sizeIndex === -1 ? textSize.steps.indexOf(14) : sizeIndex) + by))]
    if (next !== undefined) textSize.onChange(next)
  }

  return (
    <div
      className={`overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25 ${fill ? "flex min-h-0 flex-1 flex-col" : ""}`}
    >
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
                disabled={!canFormat}
                aria-label={label}
                title={label}
                className={compact ? toolButton.replace("h-8 w-8", "h-7 w-7") : toolButton}
              >
                <Icon size={compact ? 14 : 16} aria-hidden="true" />
              </button>
            </React.Fragment>
          ))}
          {images && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => openBar("image")}
              disabled={!canFormat || imageStatus.busy}
              aria-label="Insert image"
              title="Insert image (or paste or drop one in)"
              className={toolButton}
            >
              <ImagePlus size={16} aria-hidden="true" />
            </button>
          )}
          {textSize && (
            <>
              <span className="mx-1 h-5 w-px bg-outline-variant" aria-hidden="true" />
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => stepSize(-1)}
                disabled={sizeIndex === 0}
                aria-label="Decrease text size"
                title="Decrease text size"
                className={toolButton}
              >
                <AArrowDown size={16} aria-hidden="true" />
              </button>
              <span className="min-w-[44px] text-center text-[11px] font-semibold tabular-nums text-on-surface-variant" aria-live="polite">
                <span className="sr-only">Text size </span>
                {textSize.value}px
              </span>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => stepSize(1)}
                disabled={sizeIndex === textSize.steps.length - 1}
                aria-label="Increase text size"
                title="Increase text size"
                className={toolButton}
              >
                <AArrowUp size={16} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
        {!compact && (
          <div className="flex rounded-lg bg-surface-container p-0.5">
            {visual ? (
              <>
                {modeButton("visual", Type, "Visual")}
                {modeButton("write", FileCode2, "Markdown")}
              </>
            ) : (
              <>
                {modeButton("write", Pencil, "Write")}
                {modeButton("preview", Eye, "Preview")}
              </>
            )}
          </div>
        )}
      </div>

      {bar && (
        <div className="flex flex-wrap items-center gap-2 border-b border-outline-variant bg-white px-3 py-2">
          {bar.kind === "image" && images && (
            <>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={imageStatus.busy}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-60"
              >
                {imageStatus.busy ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Upload size={13} aria-hidden="true" />}
                {imageStatus.busy ? "Adding image..." : "Upload from computer"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={images.accept}
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = [...(event.target.files ?? [])]
                  event.target.value = ""
                  if (files.length > 0) void addImageFiles(files)
                }}
              />
              <span className="text-[12px] text-outline">or</span>
            </>
          )}
          <label className="flex min-w-[200px] flex-1 items-center gap-2">
            <span className="sr-only">{bar.kind === "image" ? "Image address" : "Link address"}</span>
            <input
              autoFocus
              value={bar.address}
              onChange={(event) => setBar({ ...bar, address: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  applyAddress()
                }
                if (event.key === "Escape") {
                  event.preventDefault()
                  event.stopPropagation()
                  setBar(null)
                }
              }}
              placeholder={bar.kind === "image" ? "Paste an image address (https://...)" : "Link address (https://...)"}
              className="h-8 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 text-[13px] text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
          </label>
          <button
            type="button"
            onClick={applyAddress}
            disabled={!bar.address.trim() || imageStatus.busy}
            className="whitespace-nowrap rounded-lg border border-outline-variant px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50"
          >
            {bar.kind === "image" ? "Add image" : "Add link"}
          </button>
          <button
            type="button"
            onClick={() => setBar(null)}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-high"
          >
            <X size={15} aria-hidden="true" />
          </button>
          {imageStatus.error && (
            <p role="alert" className="w-full text-[12px] text-error">
              {imageStatus.error}
            </p>
          )}
        </div>
      )}
      {!bar && imageStatus.busy && (
        <p role="status" className="flex items-center gap-2 border-b border-outline-variant bg-white px-3 py-1.5 text-[12px] text-on-surface-variant">
          <Loader2 size={13} className="animate-spin text-primary" aria-hidden="true" />
          Adding image...
        </p>
      )}
      {!bar && imageStatus.error && (
        <p role="alert" className="border-b border-outline-variant bg-white px-3 py-1.5 text-[12px] text-error">
          {imageStatus.error}
        </p>
      )}

      {mode === "visual" ? (
        <VisualEditor
          ref={visualRef}
          id={id}
          value={value}
          onChange={onChange}
          fontSize={fontSize ?? 14}
          placeholder={placeholder}
          ariaLabel={ariaLabel}
          onImageFiles={images ? (files) => void addImageFiles(files) : undefined}
          onRequestLink={() => openBar("link")}
          compact={compact}
        />
      ) : compact || mode === "write" ? (
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
          style={fontSize ? { fontSize: `${Math.max(12, fontSize - 1)}px` } : undefined}
          className={`block w-full border-0 bg-transparent ${fill ? "min-h-[320px] flex-1 resize-none" : "resize-y"} ${compact ? "px-2.5 py-2 font-body-md text-[14px]" : "px-3 py-2.5 font-code text-[13px]"} leading-relaxed text-on-surface placeholder:text-outline focus:outline-none`}
        />
      ) : (
        <div className="custom-scrollbar max-h-[55dvh] min-h-[240px] overflow-y-auto px-4 py-3">
          {value.trim() ? (
            <RichTextView text={value} fontSize={fontSize} showImages={Boolean(images)} />
          ) : (
            <p className="text-[13px] text-outline">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  )
}
