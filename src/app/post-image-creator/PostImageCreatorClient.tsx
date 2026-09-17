"use client"

import React, { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { FilePenLine, GalleryHorizontalEnd, ImagePlus, Settings2, Sparkles } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { RadioCardGroup } from "@/components/ui/RadioCardGroup"
import { BrandSettingsDialog } from "@/components/post-images/BrandSettingsDialog"
import { PostImageResult } from "@/components/post-images/PostImageResult"
import { PostImagePromptModal } from "@/components/post-images/PostImagePromptModal"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { createGenerationRequest, useGenerationRequest } from "@/hooks/useGenerationRequest"
import { createToolStore, useToolStore } from "@/lib/toolStore"
import { requestApi } from "@/lib/apiClient"
import {
  ASSET_POSES,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_POSE,
  IMAGE_SIZES,
  POST_CONTENT_MAX_LENGTH,
  POST_IMAGES_ENDPOINT,
  POST_IMAGES_HISTORY_HREF,
  POST_IMAGES_MESSAGES,
  type AssetPoseId,
  type ImageSizeId,
} from "@/constants/postImages"
import type { BrandSettings, GenerateImageInput, PostImage } from "@/types/postImages"

// What the form holds outlives the page, like every other tool
const formStore = createToolStore(
  "post-image-creator:form",
  {
    postContent: "",
    assetId: null as string | null,
    pose: DEFAULT_POSE as AssetPoseId,
    size: DEFAULT_IMAGE_SIZE as ImageSizeId,
  },
  { version: 1 }
)
const generation = createGenerationRequest<GenerateImageInput, PostImage>(
  "post-image-creator",
  `${POST_IMAGES_ENDPOINT}/generate`,
  POST_IMAGES_MESSAGES.generationFailed
)

export default function PostImageCreatorClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [settings, setSettings] = useState<BrandSettings | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isPromptOpen, setIsPromptOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const { postContent, assetId, pose, size } = useToolStore(formStore)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const { status, result, error, generate } = useGenerationRequest(generation)
  const isGenerating = status === "loading"

  // The defaults are shared, so they are read on arrival and after the dialog changes them
  useEffect(() => {
    const controller = new AbortController()
    requestApi<BrandSettings>(`${POST_IMAGES_ENDPOINT}/settings`, { signal: controller.signal })
      .then(({ data }) => setSettings(data))
      .catch(() => {
        if (!controller.signal.aborted) setSettings({ displayName: "", colors: [], assets: [], updatedAt: null })
      })
    return () => controller.abort()
  }, [])

  // A photo that is no longer in the defaults cannot stay selected
  useEffect(() => {
    if (!settings || !assetId) return
    if (!settings.assets.some((asset) => asset.id === assetId)) formStore.update({ assetId: null })
  }, [settings, assetId])

  const submit = () => {
    if (isGenerating) return
    if (!postContent.trim()) {
      setFormError(POST_IMAGES_MESSAGES.missingContent)
      return
    }
    setFormError(null)
    setNotice(null)
    generate({ postContent, assetId, pose, size })
  }

  const download = useCallback(async (image: PostImage) => {
    try {
      const { data } = await requestApi<{ url: string }>(`${POST_IMAGES_ENDPOINT}/${image.id}/link?download=1`)
      window.open(data.url, "_blank", "noopener,noreferrer")
    } catch (downloadError: unknown) {
      setNotice(downloadError instanceof Error ? downloadError.message : POST_IMAGES_MESSAGES.loadFailed)
    }
  }, [])

  const colors = settings?.colors ?? []
  const assets = settings?.assets ?? []
  const hasDefaults = colors.length > 0 || Boolean(settings?.displayName) || assets.length > 0

  return (
    <div className="font-body-md text-body-md flex h-screen min-h-screen overflow-hidden bg-background text-on-surface">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          onOpenSidebar={() => setIsSidebarOpen(true)}
          isSidebarCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapsed}
        />

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 md:p-6 lg:h-full lg:p-8">
            {/* Page header */}
            <div className="flex shrink-0 flex-col justify-between gap-3 xl:flex-row xl:items-center">
              <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-2xl font-bold text-on-surface">
                  <ImagePlus size={24} className="shrink-0 text-primary" aria-hidden="true" />
                  Post Image Creator
                </h1>
                <p className="mt-1 text-sm text-on-surface-variant">
                  A picture for your post, in your own colours, with your own photo in it when you want one.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 xl:shrink-0">
                <Link
                  href={POST_IMAGES_HISTORY_HREF}
                  className="inline-flex flex-1 items-center justify-center whitespace-nowrap gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high sm:flex-none"
                >
                  <GalleryHorizontalEnd size={16} aria-hidden="true" />
                  Generated Posts
                </Link>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="inline-flex flex-1 items-center justify-center whitespace-nowrap gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high sm:flex-none"
                >
                  <Settings2 size={16} aria-hidden="true" />
                  Default Settings
                </button>
                <button
                  type="button"
                  onClick={() => setIsPromptOpen(true)}
                  className="inline-flex flex-1 items-center justify-center whitespace-nowrap gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high sm:flex-none"
                >
                  <FilePenLine size={16} aria-hidden="true" />
                  Update Prompt
                </button>
              </div>
            </div>

            {notice && (
              <p role="alert" className="shrink-0 rounded-xl border border-error/40 bg-error-container px-3 py-2 text-[12px] text-error">
                {notice}
              </p>
            )}

            <div className="grid grid-cols-1 gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <section className="custom-scrollbar flex min-h-0 flex-col gap-4 overflow-y-auto rounded-2xl border border-outline-variant bg-white p-5 shadow-sm">
                {/* The defaults this image will use */}
                <div className="flex flex-col gap-2 rounded-xl bg-surface-container-lowest p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-outline">Your defaults</span>
                    <button
                      type="button"
                      onClick={() => setIsSettingsOpen(true)}
                      className="-my-1.5 -mr-1.5 inline-flex min-h-7 items-center rounded-md px-1.5 text-[11px] font-semibold text-primary hover:underline"
                    >
                      {hasDefaults ? "Change" : "Set them up"}
                    </button>
                  </div>
                  {settings === null ? (
                    <p className="text-[12px] text-outline">Loading your defaults...</p>
                  ) : (
                    <>
                      <p className="text-[12px] text-on-surface-variant">
                        {settings.displayName ? settings.displayName : "No name set"}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {colors.length === 0 ? (
                          <span className="text-[12px] text-outline">No colours yet, so the design picks neutrals.</span>
                        ) : (
                          colors.map((color) => (
                            <span key={color} className="flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-code text-on-surface-variant">
                              <span
                                style={{ backgroundColor: color }}
                                className="h-3 w-3 rounded-full border border-outline-variant"
                                aria-hidden="true"
                              />
                              {color}
                            </span>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* What the post is about */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="post-content" className="text-[10px] font-bold uppercase tracking-wider text-outline">
                    What is the post about
                  </label>
                  <textarea
                    id="post-content"
                    value={postContent}
                    onChange={(event) => {
                      formStore.update({ postContent: event.target.value })
                      if (formError) setFormError(null)
                    }}
                    maxLength={POST_CONTENT_MAX_LENGTH}
                    disabled={isGenerating}
                    rows={5}
                    aria-invalid={Boolean(formError)}
                    placeholder="Paste the post, or say what it is about. The image shows what it is about rather than repeating it."
                    className={`w-full resize-none rounded-xl border bg-surface-container-lowest px-4 py-3 text-sm leading-relaxed text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60 ${
                      formError ? "border-error" : "border-outline-variant focus:border-primary/50"
                    }`}
                  />
                  <p className="text-[11px] text-outline">
                    {postContent.length.toLocaleString()} / {POST_CONTENT_MAX_LENGTH.toLocaleString()} characters
                  </p>
                </div>

                {/* Which photo, if any */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-outline">Photo in the image</span>
                  {assets.length === 0 ? (
                    <p className="text-[12px] text-on-surface-variant">
                      No saved photos yet. The image is made without a person in it, which works fine.
                    </p>
                  ) : (
                    <ul className="flex flex-wrap gap-2" role="radiogroup" aria-label="Choose a photo">
                      <li>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={assetId === null}
                          onClick={() => formStore.update({ assetId: null })}
                          disabled={isGenerating}
                          className={`h-20 w-20 rounded-xl border-2 text-[11px] font-semibold transition-colors ${
                            assetId === null
                              ? "border-primary bg-primary-container text-on-primary-container"
                              : "border-outline-variant bg-white text-on-surface-variant hover:border-primary/40"
                          }`}
                        >
                          No photo
                        </button>
                      </li>
                      {assets.map((asset) => (
                        <li key={asset.id}>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={assetId === asset.id}
                            aria-label={asset.name}
                            onClick={() => formStore.update({ assetId: asset.id })}
                            disabled={isGenerating}
                            className={`relative h-20 w-20 overflow-hidden rounded-xl border-2 transition-colors ${
                              assetId === asset.id ? "border-primary" : "border-outline-variant hover:border-primary/40"
                            }`}
                          >
                            {asset.previewUrl && (
                              // A signed storage link, not a static asset
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={asset.previewUrl} alt={asset.name} className="h-full w-full object-cover" />
                            )}
                            <span className="absolute inset-x-0 bottom-0 truncate bg-on-surface/60 px-1 py-0.5 text-[10px] font-semibold text-white">
                              {asset.name}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {assetId && (
                  <RadioCardGroup
                    name="post-image-pose"
                    legend="How they should appear"
                    options={ASSET_POSES}
                    value={pose}
                    onChange={(next) => formStore.update({ pose: next })}
                    disabled={isGenerating}
                    columnsClassName="grid-cols-2 sm:grid-cols-3"
                  />
                )}

                <RadioCardGroup
                  name="post-image-size"
                  legend="Shape"
                  options={IMAGE_SIZES}
                  value={size}
                  onChange={(next) => formStore.update({ size: next })}
                  disabled={isGenerating}
                  columnsClassName="grid-cols-3"
                />

                {formError && (
                  <p role="alert" className="text-[12px] text-error">
                    {formError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={submit}
                  disabled={isGenerating}
                  className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Sparkles size={16} aria-hidden="true" />
                  {isGenerating ? "Drawing your image..." : "Create Image"}
                </button>
              </section>

              <PostImageResult status={status} image={result} error={error} onRetry={submit} onDownload={download} />
            </div>
          </div>
        </main>
      </div>

      {isSettingsOpen && settings && (
        <BrandSettingsDialog
          settings={settings}
          onSaved={(saved) => {
            setSettings(saved)
            setIsSettingsOpen(false)
          }}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
      {isPromptOpen && <PostImagePromptModal onClose={() => setIsPromptOpen(false)} />}
    </div>
  )
}
