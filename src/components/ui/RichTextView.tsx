import React from "react"
import { Check } from "lucide-react"
import { isSafeHref, parseRichText, type Inline, type RichList } from "@/lib/richText"

/**
 * Text written with the rich text editor, shown with its formatting. Everything is built from
 * React elements, never inserted as HTML, so nothing saved can put markup or script on the page.
 */
const InlineNodes: React.FC<{ nodes: Inline[] }> = ({ nodes }) => (
  <>
    {nodes.map((node, index) => {
      switch (node.kind) {
        case "text":
          return <React.Fragment key={index}>{node.text}</React.Fragment>
        case "bold":
          return (
            <strong key={index} className="font-semibold text-on-surface">
              <InlineNodes nodes={node.children} />
            </strong>
          )
        case "italic":
          return (
            <em key={index}>
              <InlineNodes nodes={node.children} />
            </em>
          )
        case "strike":
          return (
            <s key={index} className="text-outline">
              <InlineNodes nodes={node.children} />
            </s>
          )
        case "code":
          return (
            <code key={index} className="rounded bg-surface-container px-1 py-0.5 font-code text-[0.92em] text-on-surface">
              {node.text}
            </code>
          )
        case "link":
          return isSafeHref(node.href) ? (
            <a
              key={index}
              href={node.href}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all font-medium text-primary underline underline-offset-2 hover:text-on-primary-fixed-variant"
            >
              <InlineNodes nodes={node.children} />
            </a>
          ) : (
            <InlineNodes key={index} nodes={node.children} />
          )
      }
    })}
  </>
)

// Lines kept as written, so a description without formatting reads exactly as it was typed
const Lines: React.FC<{ lines: Inline[][] }> = ({ lines }) => (
  <>
    {lines.map((line, index) => (
      <React.Fragment key={index}>
        {index > 0 && <br />}
        <InlineNodes nodes={line} />
      </React.Fragment>
    ))}
  </>
)

const ListView: React.FC<{ list: RichList }> = ({ list }) => {
  const isChecklist = list.items.every((item) => item.checked !== null)
  const Tag = list.ordered ? "ol" : "ul"
  return (
    <Tag
      start={list.ordered ? list.start : undefined}
      className={isChecklist ? "space-y-1" : `space-y-1 pl-5 ${list.ordered ? "list-decimal" : "list-disc"} marker:text-outline`}
    >
      {list.items.map((item, index) => (
        <li key={index} className={item.checked !== null ? "flex list-none flex-col" : ""}>
          {item.checked !== null ? (
            <span className="flex items-start gap-2">
              <span
                role="img"
                aria-label={item.checked ? "Done" : "Not done"}
                className={`mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  item.checked ? "border-primary bg-primary text-white" : "border-outline-variant bg-white"
                }`}
              >
                {item.checked && <Check size={11} strokeWidth={3} aria-hidden="true" />}
              </span>
              <span className={item.checked ? "text-outline line-through" : ""}>
                <InlineNodes nodes={item.children} />
              </span>
            </span>
          ) : (
            <InlineNodes nodes={item.children} />
          )}
          {item.sublist && (
            <div className={`mt-1 ${item.checked !== null ? "pl-6" : ""}`}>
              <ListView list={item.sublist} />
            </div>
          )}
        </li>
      ))}
    </Tag>
  )
}

const HEADING_CLASS = {
  1: "text-[18px] font-bold",
  2: "text-[16px] font-bold",
  3: "text-[14px] font-semibold",
} as const

export const RichTextView: React.FC<{ text: string; className?: string }> = ({ text, className = "" }) => (
  <div className={`flex flex-col gap-3 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-on-surface-variant ${className}`}>
    {parseRichText(text).map((block, index) => {
      switch (block.kind) {
        case "heading": {
          const Tag = (["h3", "h4", "h5"] as const)[block.level - 1]
          return (
            <Tag key={index} className={`${HEADING_CLASS[block.level]} leading-snug text-on-surface`}>
              <InlineNodes nodes={block.children} />
            </Tag>
          )
        }
        case "paragraph":
          return (
            <p key={index}>
              <Lines lines={block.lines} />
            </p>
          )
        case "quote":
          return (
            <blockquote key={index} className="border-l-4 border-primary/40 bg-primary-fixed/20 py-1.5 pl-3 pr-2 italic">
              <Lines lines={block.lines} />
            </blockquote>
          )
        case "list":
          return <ListView key={index} list={block.list} />
        case "code":
          return (
            <pre
              key={index}
              className="overflow-x-auto whitespace-pre rounded-lg border border-outline-variant bg-surface-container-low p-3 font-code text-[12.5px] leading-relaxed text-on-surface"
            >
              <code>{block.text}</code>
            </pre>
          )
        case "divider":
          return <hr key={index} className="border-outline-variant" />
      }
    })}
  </div>
)
