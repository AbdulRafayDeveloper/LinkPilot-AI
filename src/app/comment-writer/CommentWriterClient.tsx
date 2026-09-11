"use client"

import React, { useCallback, useRef, useState } from "react"
import { AlertTriangle, FilePenLine, Loader2, MessageSquareText, Sparkles } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { PostInput } from "@/components/post-input/PostInput"
import { TuneSelector } from "@/components/comment-writer/TuneSelector"
import { CommentResult } from "@/components/comment-writer/CommentResult"
import { TunePromptsModal } from "@/components/comment-writer/TunePromptsModal"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { useCommentGenerator } from "@/hooks/useCommentGenerator"
import { COMMENT_WRITER_MESSAGES, type CommentTuneId } from "@/constants/commentWriter"
import type { PostInputMode } from "@/constants/postInput"

const FORM_ERROR_ID = "comment-writer-form-error"
const { missingPost, missingTune } = COMMENT_WRITER_MESSAGES

export default function CommentWriterClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isPromptsOpen, setIsPromptsOpen] = useState(false)
  const [mode, setMode] = useState<PostInputMode>("text")
  const [postText, setPostText] = useState("")
  const [image, setImage] = useState<File | null>(null)
  const [tune, setTune] = useState<CommentTuneId | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const resultRef = useRef<HTMLElement>(null)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const { status, result, stages, error, generate } = useCommentGenerator()
  const isGenerating = status === "loading"
  const isPostError = formError !== null && formError !== missingTune

  const clearPostError = useCallback(() => setFormError((current) => (current === missingTune ? current : null)), [])

  const handleImageSelect = useCallback(
    (file: File) => {
      setImage(file)
      clearPostError()
    },
    [clearPostError]
  )
  const handleImageRemove = useCallback(() => setImage(null), [])

  const submit = () => {
    const hasPost = mode === "text" ? postText.trim().length > 0 : image !== null
    if (!hasPost) {
      setFormError(missingPost)
      if (mode === "text") textareaRef.current?.focus()
      return
    }
    if (!tune) {
      setFormError(missingTune)
      return
    }
    setFormError(null)
    generate({ tune, mode, postText, image })
    // On stacked (mobile) layouts the result sits below the form
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
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
                  <MessageSquareText size={24} className="text-primary shrink-0" aria-hidden="true" />
                  Comment Writer
                </h1>
                <p className="text-sm text-on-surface-variant mt-1">
                  Write thoughtful, relevant comments for LinkedIn posts.
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

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-5 lg:flex-1 lg:min-h-0">
              {/* Input */}
              <form
                noValidate
                onSubmit={(event) => {
                  event.preventDefault()
                  submit()
                }}
                className="bg-white border border-outline-variant rounded-2xl shadow-sm p-5 flex flex-col gap-4 min-h-0"
              >
                <PostInput
                  idPrefix="comment-writer"
                  mode={mode}
                  onModeChange={(nextMode) => {
                    setMode(nextMode)
                    clearPostError()
                  }}
                  text={postText}
                  onTextChange={(text) => {
                    setPostText(text)
                    clearPostError()
                  }}
                  image={image}
                  onImageSelect={handleImageSelect}
                  onImageRemove={handleImageRemove}
                  onImageReject={setFormError}
                  disabled={isGenerating}
                  invalid={isPostError}
                  describedBy={isPostError ? FORM_ERROR_ID : undefined}
                  textareaRef={textareaRef}
                />

                <TuneSelector
                  value={tune}
                  onChange={(nextTune) => {
                    setTune(nextTune)
                    if (formError === missingTune) setFormError(null)
                  }}
                  disabled={isGenerating}
                  invalid={formError === missingTune}
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
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-on-primary-fixed-variant text-white rounded-xl text-sm font-semibold shadow-sm active:scale-[0.99] transition-all disabled:opacity-70 disabled:cursor-not-allowed shrink-0"
                >
                  {isGenerating ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles size={16} aria-hidden="true" />
                  )}
                  {isGenerating ? "Generating comment..." : "Generate Comment"}
                </button>
              </form>

              {/* Output */}
              <CommentResult
                ref={resultRef}
                status={status}
                result={result}
                stages={stages}
                error={error}
                onRegenerate={submit}
              />
            </div>
          </div>
        </main>
      </div>

      {isPromptsOpen && <TunePromptsModal initialTune={tune} onClose={() => setIsPromptsOpen(false)} />}
    </div>
  )
}
