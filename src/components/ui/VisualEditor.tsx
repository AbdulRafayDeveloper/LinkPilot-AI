"use client"

import React, { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react"
import { CHECKBOX_ATTRIBUTE, CHECKED_ATTRIBUTE, CHECKLIST_ATTRIBUTE, toMarkdown, toTree, type TreeNode } from "@/lib/richTextDom"

/**
 * The visual half of `RichTextEditor`: the description drawn with its formatting and edited in
 * place, the way a word processor shows it, so nobody sees ** or # while writing. It still reads and
 * writes the same Markdown text (`lib/richTextDom.ts`), so what is saved, searched and copied is
 * exactly what the Markdown tab shows.
 *
 * Formatting goes through the browser's own editing commands, which keeps Ctrl/⌘+Z working. What the
 * browser makes is read back through `toMarkdown`, which keeps only what the text can hold, so
 * pasting from any site brings its words and structure and never its markup.
 */

export type VisualTool =
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
  | "divider"

export interface VisualEditorHandle {
  run: (tool: VisualTool) => void
  // Remembers where the caret is before a field outside the editor takes focus (a link or image address)
  keepSelection: () => void
  insertLink: (href: string) => void
  insertImage: (src: string) => void
}

interface VisualEditorProps {
  id: string
  value: string
  onChange: (value: string) => void
  fontSize: number
  placeholder?: string
  ariaLabel?: string
  // Asked when an image is pasted or dropped: stores it and answers the address to show it from
  onImageFiles?: (files: File[]) => void
  onRequestLink?: () => void
  // A few lines tall, for a note under a task, rather than a whole page
  compact?: boolean
}

const BLOCK_FORMATS: Partial<Record<VisualTool, string>> = { h1: "H1", h2: "H2", h3: "H3", quote: "BLOCKQUOTE", codeBlock: "PRE" }
const FORMATTED_BLOCK = "h1,h2,h3,h4,h5,h6,blockquote,pre,p,li,div"

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

function toDom(node: TreeNode, doc: Document): Node {
  if (node.nodeType === 3) return doc.createTextNode(node.textContent)
  const element = doc.createElement(node.nodeName.toLowerCase())
  for (const [name, value] of Object.entries(node.attributes)) element.setAttribute(name, value)
  for (const child of node.childNodes) element.appendChild(toDom(child, doc))
  return element
}

// The HTML of saved text for the browser's own insert, which keeps the paste on the undo stack
function htmlOf(markdown: string): string {
  const tree = toTree(markdown)
  const holder = document.createElement("div")
  // One paragraph pasted into a line joins that line rather than breaking it in two
  const nodes = tree.length === 1 && tree[0].nodeName === "P" ? tree[0].childNodes : tree
  for (const node of nodes) holder.appendChild(toDom(node, document))
  return holder.innerHTML
}

/** Gives every checklist item its box, and takes the box off items that are no longer in a checklist. */
function decorateChecklists(root: HTMLElement) {
  for (const box of root.querySelectorAll<HTMLElement>(`[${CHECKBOX_ATTRIBUTE}]`)) {
    const item = box.parentElement
    if (!item || item.tagName !== "LI" || !item.parentElement?.hasAttribute(CHECKLIST_ATTRIBUTE) || item.firstChild !== box) box.remove()
  }
  for (const item of root.querySelectorAll<HTMLElement>(`ul[${CHECKLIST_ATTRIBUTE}] > li`)) {
    if (!item.hasAttribute(CHECKED_ATTRIBUTE)) item.setAttribute(CHECKED_ATTRIBUTE, "false")
    if (item.firstElementChild?.hasAttribute(CHECKBOX_ATTRIBUTE) && item.firstChild === item.firstElementChild) continue
    const box = document.createElement("span")
    box.setAttribute(CHECKBOX_ATTRIBUTE, "")
    box.setAttribute("contenteditable", "false")
    box.setAttribute("role", "checkbox")
    item.prepend(box)
  }
  for (const item of root.querySelectorAll<HTMLElement>(`ul[${CHECKLIST_ATTRIBUTE}] > li`)) {
    item.firstElementChild?.setAttribute("aria-checked", item.getAttribute(CHECKED_ATTRIBUTE) === "true" ? "true" : "false")
  }
}

export const VisualEditor = forwardRef<VisualEditorHandle, VisualEditorProps>(function VisualEditor(
  { id, value, onChange, fontSize, placeholder, ariaLabel, onImageFiles, onRequestLink, compact = false },
  ref
) {
  const rootRef = useRef<HTMLDivElement>(null)
  // The text this page last drew or wrote; a value that differs came from outside and is drawn again
  const shown = useRef<string | null>(null)
  const savedRange = useRef<Range | null>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || value === shown.current) return
    root.replaceChildren(...toTree(value).map((node) => toDom(node, document)))
    decorateChecklists(root)
    root.dataset.empty = String(!value.trim())
    shown.current = value
  }, [value])

  const emit = () => {
    const root = rootRef.current
    if (!root) return
    decorateChecklists(root)
    const markdown = toMarkdown(root, { origin: window.location.origin })
    root.dataset.empty = String(!markdown.trim() && !root.querySelector("img,hr,li"))
    if (markdown === shown.current) return
    shown.current = markdown
    onChange(markdown)
  }

  const exec = (command: string, argument?: string) => {
    document.execCommand(command, false, argument)
    emit()
  }

  const inRoot = (node: Node | null) => Boolean(node && rootRef.current?.contains(node))
  const selectionElement = (): Element | null => {
    const node = window.getSelection()?.anchorNode ?? null
    if (!inRoot(node)) return null
    return node?.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element)
  }
  const closestIn = (selector: string): HTMLElement | null => {
    const found = selectionElement()?.closest<HTMLElement>(selector) ?? null
    return found && found !== rootRef.current && inRoot(found) ? found : null
  }

  // Puts the caret back where it was, or at the end when the editor was never clicked into
  const restoreSelection = () => {
    const root = rootRef.current
    if (!root) return
    root.focus()
    const selection = window.getSelection()
    if (!selection) return
    const range = savedRange.current && inRoot(savedRange.current.startContainer) ? savedRange.current : null
    selection.removeAllRanges()
    if (range) {
      selection.addRange(range)
      return
    }
    const end = document.createRange()
    end.selectNodeContents(root)
    end.collapse(false)
    selection.addRange(end)
  }

  const toggleChecklist = () => {
    const list = closestIn("ul,ol")
    if (list?.tagName === "UL" && list.hasAttribute(CHECKLIST_ATTRIBUTE)) {
      exec("insertUnorderedList")
      return
    }
    if (list?.tagName !== "UL") document.execCommand("insertUnorderedList")
    closestIn("ul")?.setAttribute(CHECKLIST_ATTRIBUTE, "true")
    emit()
  }

  const toggleInlineCode = () => {
    const code = closestIn("code")
    if (code && !code.closest("pre")) {
      code.replaceWith(document.createTextNode(code.textContent ?? ""))
      emit()
      return
    }
    const selected = window.getSelection()?.toString() || "code"
    exec("insertHTML", `<code>${escapeHtml(selected)}</code>&#8203;`)
  }

  useImperativeHandle(ref, () => ({
    run(tool) {
      if (!inRoot(window.getSelection()?.anchorNode ?? null)) restoreSelection()
      const block = BLOCK_FORMATS[tool]
      if (block) {
        const current = closestIn(FORMATTED_BLOCK)
        exec("formatBlock", current?.tagName === block ? "<p>" : `<${block.toLowerCase()}>`)
        return
      }
      switch (tool) {
        case "bold":
          return exec("bold")
        case "italic":
          return exec("italic")
        case "strike":
          return exec("strikeThrough")
        case "bullet": {
          const list = closestIn("ul")
          if (list?.hasAttribute(CHECKLIST_ATTRIBUTE)) {
            list.removeAttribute(CHECKLIST_ATTRIBUTE)
            return emit()
          }
          return exec("insertUnorderedList")
        }
        case "number":
          return exec("insertOrderedList")
        case "check":
          return toggleChecklist()
        case "code":
          return toggleInlineCode()
        case "divider":
          return exec("insertHorizontalRule")
      }
    },
    keepSelection() {
      const range = window.getSelection()?.rangeCount ? window.getSelection()?.getRangeAt(0) : null
      savedRange.current = range && inRoot(range.startContainer) ? range.cloneRange() : null
    },
    insertLink(href) {
      restoreSelection()
      const selected = window.getSelection()?.toString()
      if (selected) exec("createLink", href)
      else exec("insertHTML", `<a href="${escapeHtml(href)}">${escapeHtml(href)}</a>&nbsp;`)
    },
    insertImage(src) {
      restoreSelection()
      exec("insertHTML", `<img src="${escapeHtml(src)}" alt="">`)
      // The caret stays where it was, so a second image lands after the first
      const selection = window.getSelection()
      savedRange.current = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null
    },
  }))

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const mod = event.metaKey || event.ctrlKey
    const key = event.key.toLowerCase()
    // Underline has no place in the saved text, so it isn't offered by its shortcut either
    if (mod && key === "u") {
      event.preventDefault()
      return
    }
    if (mod && key === "k" && !event.shiftKey) {
      event.preventDefault()
      const range = window.getSelection()?.rangeCount ? window.getSelection()?.getRangeAt(0) : null
      savedRange.current = range ? range.cloneRange() : null
      onRequestLink?.()
      return
    }
    if (mod && key === "x" && event.shiftKey) {
      event.preventDefault()
      exec("strikeThrough")
      return
    }
    // Tab and Shift+Tab move a list item in and out a level; anywhere else Tab still moves focus
    if (event.key === "Tab" && !mod && !event.altKey && closestIn("li")) {
      event.preventDefault()
      exec(event.shiftKey ? "outdent" : "indent")
    }
  }

  // A checklist box is not text: a click on it ticks the item and never moves the caret
  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const box = (event.target as HTMLElement).closest?.(`[${CHECKBOX_ATTRIBUTE}]`)
    const item = box?.parentElement
    if (!box || !item) return
    event.preventDefault()
    item.setAttribute(CHECKED_ATTRIBUTE, item.getAttribute(CHECKED_ATTRIBUTE) === "true" ? "false" : "true")
    emit()
  }

  const imagesIn = (list: FileList | null | undefined) => [...(list ?? [])].filter((file) => file.type.startsWith("image/"))

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const images = imagesIn(event.clipboardData.files)
    if (images.length > 0 && onImageFiles) {
      event.preventDefault()
      const range = window.getSelection()?.rangeCount ? window.getSelection()?.getRangeAt(0) : null
      savedRange.current = range ? range.cloneRange() : null
      onImageFiles(images)
      return
    }
    const html = event.clipboardData.getData("text/html")
    const text = event.clipboardData.getData("text/plain")
    if (!html && !text) return
    event.preventDefault()
    // Another site's page is read through the same filter as the editor; plain text is read as Markdown,
    // which is what an AI chat's Copy button gives
    const markdown = html
      ? toMarkdown(new DOMParser().parseFromString(html, "text/html").body, { origin: window.location.origin })
      : text
    const inserted = htmlOf(markdown)
    if (inserted) exec("insertHTML", inserted)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    const images = imagesIn(event.dataTransfer.files)
    if (images.length === 0 || !onImageFiles) return
    event.preventDefault()
    const range = document.caretRangeFromPoint?.(event.clientX, event.clientY) ?? null
    savedRange.current = range && inRoot(range.startContainer) ? range : null
    onImageFiles(images)
  }

  const handleFocus = () => {
    // New paragraphs as <p>, and bold and italic as tags rather than inline styles
    document.execCommand("defaultParagraphSeparator", false, "p")
    document.execCommand("styleWithCSS", false, "false")
  }

  return (
    <div
      ref={rootRef}
      id={id}
      role="textbox"
      aria-multiline="true"
      aria-label={ariaLabel}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-placeholder={placeholder}
      onInput={emit}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onFocus={handleFocus}
      style={{ fontSize: `${fontSize}px` }}
      className={`visual-editor custom-scrollbar overflow-y-auto leading-relaxed text-on-surface focus:outline-none ${
        compact ? "max-h-[45dvh] min-h-[88px] px-3 py-2" : "min-h-[320px] flex-1 px-4 py-3"
      }`}
    />
  )
})
