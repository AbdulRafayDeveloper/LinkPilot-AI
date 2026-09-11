"use client"

import React, { useCallback, useDeferredValue, useMemo, useRef, useState } from "react"
import { AlertTriangle, FilePenLine, Loader2, Reply, Sparkles } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { RadioCardGroup } from "@/components/ui/RadioCardGroup"
import { PostInput } from "@/components/post-input/PostInput"
import { DetectedComments } from "@/components/post-comment-replies/DetectedComments"
import { ReplyResult } from "@/components/post-comment-replies/ReplyResult"
import { ReplyPromptsModal } from "@/components/post-comment-replies/ReplyPromptsModal"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { usePostCommentReplyGenerator } from "@/hooks/usePostCommentReplyGenerator"
import { parseLinkedInConversation } from "@/lib/linkedinComments"
import {
  DEFAULT_REPLY_CONTEXT,
  POST_COMMENT_REPLY_MESSAGES,
  REPLY_COMMENTS_MAX_LENGTH,
  REPLY_CONTEXTS,
  REPLY_STYLES,
  type ReplyContextId,
  type ReplyStyleId,
} from "@/constants/postCommentReplies"
import type { PostInputMode } from "@/constants/postInput"

const ID_PREFIX = "post-comment-replies"
const COMMENTS_INPUT_ID = `${ID_PREFIX}-comments`
const COMMENTS_HINT_ID = `${ID_PREFIX}-comments-hint`
const FORM_ERROR_ID = `${ID_PREFIX}-form-error`
const { missingComment, missingStyle } = POST_COMMENT_REPLY_MESSAGES

const POST_PLACEHOLDER = "Paste the original post here. It's optional, but it helps the reply stay on topic."

const COMMENTS_PLACEHOLDER = `Paste the comments you want to reply to, for example:

Sarah Khan: Interesting point. How do you handle urgent fixes?
Omar Farooq: We saw the same thing after switching.`

const cardClass = "bg-white border border-outline-variant rounded-2xl shadow-sm p-5 flex flex-col gap-4"
const labelClass = "text-[10px] font-bold text-outline uppercase tracking-wider"

export default function PostCommentRepliesClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isPromptsOpen, setIsPromptsOpen] = useState(false)
  const [context, setContext] = useState<ReplyContextId>(DEFAULT_REPLY_CONTEXT)
  const [style, setStyle] = useState<ReplyStyleId | null>(null)
  const [postMode, setPostMode] = useState<PostInputMode>("text")
  const [postText, setPostText] = useState("")
  const [postImage, setPostImage] = useState<File | null>(null)
  const [comments, setComments] = useState("")
  const [selectedCommentKey, setSelectedCommentKey] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const commentsRef = useRef<HTMLTextAreaElement>(null)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const { status, stage, result, error, generate } = usePostCommentReplyGenerator()
  const isGenerating = status === "loading"
  // Anything other than the comment and style messages comes from the post input (image checks)
  const isPostError = formError !== null && formError !== missingComment && formError !== missingStyle

  // Parsing trails typing slightly so large pastes never make the textarea lag
  const deferredComments = useDeferredValue(comments)
  const detectedComments = useMemo(() => parseLinkedInConversation(deferredComments).comments, [deferredComments])

  const clearPostError = useCallback(
    () => setFormError((current) => (current === missingComment || current === missingStyle ? current : null)),
    []
  )
  const handlePostImageSelect = useCallback(
    (file: File) => {
      setPostImage(file)
      clearPostError()
    },
    [clearPostError]
  )
  const handlePostImageRemove = useCallback(() => setPostImage(null), [])

  const submit = () => {
    if (!comments.trim()) {
      setFormError(missingComment)
      commentsRef.current?.focus()
      return
    }
    if (!style) {
      setFormError(missingStyle)
      return
    }
    setFormError(null)
    // Resolve the picked comment against the current text, not the deferred parse
    const target = parseLinkedInConversation(comments).comments.find((comment) => comment.key === selectedCommentKey)
    generate({
      context,
      style,
      comments,
      postMode,
      postText,
      postImage,
      targetComment: target ? { author: target.author, text: target.text } : null,
    })
  }

  return (
    <div className="font-body-md text-body-md min-h-screen bg-background text-on-surface flex overflow-hidden h-screen">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        <Header
          onOpenSidebar={() => setIsSidebarOpen(true)}
          isSidebarCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapsed}
        />

        <main className="flex-1 overflow-y-auto bg-[#FAF7F2] overflow-x-hidden">
          <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-5 lg:h-full">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
                  <Reply size={24} className="text-primary shrink-0" aria-hidden="true" />
                  Post Comment Replies
                </h1>
                <p className="text-sm text-on-surface-variant mt-1">
                  Write a natural reply to a comment on your post or in someone else&apos;s thread.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPromptsOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-outline-variant bg-white text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-colors sm:shrink-0"
              >
                <FilePenLine size={16} aria-hidden="true" />
                Update Prompt
              </button>
            </div>

            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                submit()
              }}
              className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-5 lg:flex-1 lg:min-h-[640px]"
            >
              {/* The input column grows with its content (post preview, detected comments) instead of squeezing it */}
              <div className="flex flex-col gap-5">
                {/* Post: where the comment is, and the original post as text or a screenshot */}
                <section aria-label="Post" className={`${cardClass} shrink-0`}>
                  <RadioCardGroup
                    name={`${ID_PREFIX}-context`}
                    legend="Where is the comment?"
                    options={REPLY_CONTEXTS}
                    value={context}
                    onChange={setContext}
                    disabled={isGenerating}
                    columnsClassName="grid-cols-1 min-[440px]:grid-cols-2"
                  />
                  <PostInput
                    idPrefix={ID_PREFIX}
                    mode={postMode}
                    onModeChange={(nextMode) => {
                      setPostMode(nextMode)
                      clearPostError()
                    }}
                    text={postText}
                    onTextChange={setPostText}
                    image={postImage}
                    onImageSelect={handlePostImageSelect}
                    onImageRemove={handlePostImageRemove}
                    onImageReject={setFormError}
                    placeholder={POST_PLACEHOLDER}
                    optional
                    compact
                    disabled={isGenerating}
                    invalid={isPostError}
                    describedBy={isPostError ? FORM_ERROR_ID : undefined}
                  />
                </section>

                {/* Comments: pasted separately from the post */}
                <section aria-label="Comments" className={`${cardClass} lg:flex-1`}>
                  <div className="flex flex-col flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label htmlFor={COMMENTS_INPUT_ID} className={labelClass}>
                        Comments
                      </label>
                      <span className="text-[11px] text-outline">
                        {comments.length.toLocaleString()} / {REPLY_COMMENTS_MAX_LENGTH.toLocaleString()}
                      </span>
                    </div>
                    <textarea
                      ref={commentsRef}
                      id={COMMENTS_INPUT_ID}
                      value={comments}
                      onChange={(event) => {
                        setComments(event.target.value)
                        if (formError === missingComment) setFormError(null)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                          event.preventDefault()
                          if (!isGenerating) submit()
                        }
                      }}
                      maxLength={REPLY_COMMENTS_MAX_LENGTH}
                      disabled={isGenerating}
                      placeholder={COMMENTS_PLACEHOLDER}
                      aria-invalid={formError === missingComment}
                      aria-describedby={formError === missingComment ? `${COMMENTS_HINT_ID} ${FORM_ERROR_ID}` : COMMENTS_HINT_ID}
                      className="flex-1 w-full min-h-[180px] lg:min-h-[130px] resize-none rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-[13px] leading-relaxed text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-70"
                    />
                    <p id={COMMENTS_HINT_ID} className="text-[11px] text-outline mt-1.5">
                      Paste one comment or a whole thread. Press Ctrl + Enter to generate.
                    </p>
                  </div>

                  {detectedComments.length > 0 && (
                    <DetectedComments
                      name={`${ID_PREFIX}-target`}
                      comments={detectedComments}
                      selectedKey={selectedCommentKey}
                      onSelect={setSelectedCommentKey}
                      disabled={isGenerating}
                    />
                  )}
                </section>
              </div>

              {/* Style, action and result */}
              <div className="flex flex-col gap-5 min-h-0">
                <div className={`${cardClass} shrink-0`}>
                  <RadioCardGroup
                    name={`${ID_PREFIX}-style`}
                    legend="Reply style"
                    options={REPLY_STYLES}
                    value={style}
                    onChange={(nextStyle) => {
                      setStyle(nextStyle)
                      if (formError === missingStyle) setFormError(null)
                    }}
                    disabled={isGenerating}
                    invalid={formError === missingStyle}
                    columnsClassName="grid-cols-2 md:grid-cols-3 lg:grid-cols-2"
                    wrapLabels
                  />

                  {formError && (
                    <p id={FORM_ERROR_ID} role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-error">
                      <AlertTriangle size={14} className="shrink-0" aria-hidden="true" />
                      {formError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isGenerating}
                    aria-busy={isGenerating}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-on-primary-fixed-variant text-white rounded-xl text-sm font-semibold shadow-sm active:scale-[0.99] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Sparkles size={16} aria-hidden="true" />
                    )}
                    {isGenerating ? "Generating reply..." : "Generate Reply"}
                  </button>
                </div>

                <ReplyResult status={status} stage={stage} result={result} error={error} onRetry={submit} />
              </div>
            </form>
          </div>
        </main>
      </div>

      {isPromptsOpen && (
        <ReplyPromptsModal initialContext={context} initialStyle={style} onClose={() => setIsPromptsOpen(false)} />
      )}
    </div>
  )
}
