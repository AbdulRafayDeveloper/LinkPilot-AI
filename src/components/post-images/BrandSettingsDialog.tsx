"use client"

import React, { useRef, useState } from "react"
import { ImagePlus, Loader2, Plus, Save, Trash2, X } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { requestApi, fetchWithRetry } from "@/lib/apiClient"
import {
  ASSET_CONTENT_TYPES,
  ASSET_MAX_BYTES,
  ASSET_MAX_LABEL,
  ASSET_NAME_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  HEX_COLOR_PATTERN,
  MAX_BRAND_ASSETS,
  MAX_BRAND_COLORS,
  POST_IMAGES_ENDPOINT,
  POST_IMAGES_MESSAGES,
} from "@/constants/postImages"
import type { AssetUploadPlan, BrandSettings } from "@/types/postImages"

interface BrandSettingsDialogProps {
  settings: BrandSettings
  onSaved: (settings: BrandSettings) => void
  onClose: () => void
}

// A photo already saved, or one picked here and not uploaded yet
type AssetDraft = {
  id: string
  name: string
  previewUrl: string | null
  file: File | null
  contentType: string
  size: number
}

const labelClass = "text-[10px] font-bold uppercase tracking-wider text-outline"
const fieldClass =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-[13px] text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"

/**
 * The brand defaults: the name that goes on the posts, the colours a design may use, and the
 * photos that can be dropped into an image. Saved once and used by every image after that.
 *
 * A photo picked here goes straight from the browser to storage through a signed link, and only
 * joins the defaults when the settings are saved, so an abandoned dialog changes nothing.
 */
export const BrandSettingsDialog: React.FC<BrandSettingsDialogProps> = ({ settings, onSaved, onClose }) => {
  const [displayName, setDisplayName] = useState(settings.displayName)
  const [colors, setColors] = useState<string[]>(settings.colors.length > 0 ? settings.colors : ["#5b21b6"])
  const [assets, setAssets] = useState<AssetDraft[]>(
    settings.assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      previewUrl: asset.previewUrl,
      file: null,
      contentType: asset.contentType,
      size: asset.size,
    }))
  )
  const [isSaving, setIsSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const changeColor = (index: number, value: string) => {
    setColors((current) => current.map((color, position) => (position === index ? value : color)))
    setProblem(null)
  }

  const addColor = () => {
    if (colors.length >= MAX_BRAND_COLORS) {
      setProblem(POST_IMAGES_MESSAGES.tooManyColors)
      return
    }
    setColors((current) => [...current, "#000000"])
  }

  const pickFiles = (files: File[]) => {
    setProblem(null)
    const accepted: AssetDraft[] = []
    for (const file of files) {
      if (assets.length + accepted.length >= MAX_BRAND_ASSETS) {
        setProblem(POST_IMAGES_MESSAGES.tooManyAssets)
        break
      }
      if (!ASSET_CONTENT_TYPES.includes(file.type)) {
        setProblem(POST_IMAGES_MESSAGES.unsupportedAsset)
        continue
      }
      if (file.size > ASSET_MAX_BYTES) {
        setProblem(POST_IMAGES_MESSAGES.assetTooLarge)
        continue
      }
      accepted.push({
        id: `new-${Date.now()}-${accepted.length}`,
        // A sensible starting name, which the user can change before saving
        name: file.name.replace(/\.[^.]+$/, "").slice(0, ASSET_NAME_MAX_LENGTH),
        previewUrl: URL.createObjectURL(file),
        file,
        contentType: file.type,
        size: file.size,
      })
    }
    if (accepted.length > 0) setAssets((current) => [...current, ...accepted])
  }

  const save = async () => {
    if (isSaving) return
    const cleanedColors = colors.map((color) => color.trim()).filter(Boolean)
    if (cleanedColors.length === 0) {
      setProblem(POST_IMAGES_MESSAGES.noColors)
      return
    }
    const bad = cleanedColors.find((color) => !HEX_COLOR_PATTERN.test(color))
    if (bad) {
      setProblem(`${bad} is not a hex colour. ${POST_IMAGES_MESSAGES.badColor}`)
      return
    }
    const unnamed = assets.find((asset) => !asset.name.trim())
    if (unnamed) {
      setProblem(POST_IMAGES_MESSAGES.missingAssetName)
      return
    }

    setIsSaving(true)
    setProblem(null)
    try {
      // Each new photo gets its own signed link and goes straight to storage
      const uploaded = await Promise.all(
        assets.map(async (asset) => {
          if (!asset.file) return { id: asset.id, name: asset.name.trim() }
          const { data: plan } = await requestApi<AssetUploadPlan>(`${POST_IMAGES_ENDPOINT}/settings/assets`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contentType: asset.contentType, size: asset.size }),
          }, { retry: true })
          const put = await fetchWithRetry(plan.url, {
            method: "PUT",
            headers: { "Content-Type": asset.contentType },
            body: asset.file,
          })
          if (!put.ok) throw new Error(POST_IMAGES_MESSAGES.assetUploadFailed)
          return { id: plan.assetId, name: asset.name.trim(), contentType: asset.contentType, size: asset.size }
        })
      )

      const { data } = await requestApi<BrandSettings>(`${POST_IMAGES_ENDPOINT}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim(), colors: cleanedColors, assets: uploaded }),
      })
      onSaved(data)
    } catch (error: unknown) {
      setProblem(error instanceof Error ? error.message : POST_IMAGES_MESSAGES.assetUploadFailed)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      title="Default settings"
      description="Your name, the colours every design may use, and the photos you can drop into an image. Saved once and used by every image after that."
      onClose={onClose}
      isCloseDisabled={isSaving}
      size="default"
      initialFocusRef={nameRef}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-[20px] text-xs" aria-live="polite">
            {problem && (
              <p role="alert" className="text-error">
                {problem}
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
              {isSaving ? "Saving..." : "Save defaults"}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="brand-name" className={labelClass}>
            Name on your posts
          </label>
          <input
            id="brand-name"
            ref={nameRef}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            disabled={isSaving}
            placeholder="Abdul Rafay"
            className={`${fieldClass} py-2.5`}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className={labelClass}>Brand colours</span>
            <span className="text-[11px] text-outline">
              {colors.length} / {MAX_BRAND_COLORS}
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {colors.map((color, index) => (
              <li key={index} className="flex items-center gap-2">
                <input
                  type="color"
                  value={HEX_COLOR_PATTERN.test(color) && color.length === 7 ? color : "#000000"}
                  onChange={(event) => changeColor(index, event.target.value)}
                  disabled={isSaving}
                  aria-label={`Pick colour ${index + 1}`}
                  className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-outline-variant bg-transparent"
                />
                <input
                  value={color}
                  onChange={(event) => changeColor(index, event.target.value)}
                  maxLength={7}
                  disabled={isSaving}
                  aria-label={`Colour ${index + 1} hex code`}
                  aria-invalid={Boolean(color) && !HEX_COLOR_PATTERN.test(color)}
                  className={`${fieldClass} py-2 font-code ${
                    color && !HEX_COLOR_PATTERN.test(color) ? "border-error" : ""
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setColors((current) => current.filter((_unused, position) => position !== index))}
                  disabled={isSaving || colors.length === 1}
                  aria-label={`Remove colour ${index + 1}`}
                  className="shrink-0 rounded-md p-2 text-outline transition-colors hover:bg-error/5 hover:text-error disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={addColor}
            disabled={isSaving || colors.length >= MAX_BRAND_COLORS}
            className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-outline-variant bg-white px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={13} aria-hidden="true" />
            Add colour
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className={labelClass}>Your photos</span>
            <span className="text-[11px] text-outline">
              {assets.length} / {MAX_BRAND_ASSETS}
            </span>
          </div>
          {assets.length > 0 && (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {assets.map((asset, index) => (
                <li key={asset.id} className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-2">
                  {asset.previewUrl ? (
                    // A signed storage link or a local preview, not a static asset
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.previewUrl} alt={asset.name} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-primary">
                      <ImagePlus size={16} aria-hidden="true" />
                    </div>
                  )}
                  <input
                    value={asset.name}
                    onChange={(event) =>
                      setAssets((current) =>
                        current.map((entry, position) => (position === index ? { ...entry, name: event.target.value } : entry))
                      )
                    }
                    maxLength={ASSET_NAME_MAX_LENGTH}
                    disabled={isSaving}
                    aria-label={`Name for photo ${index + 1}`}
                    placeholder="Name this photo"
                    className={`${fieldClass} py-1.5`}
                  />
                  <button
                    type="button"
                    onClick={() => setAssets((current) => current.filter((_unused, position) => position !== index))}
                    disabled={isSaving}
                    aria-label={`Remove ${asset.name || "photo"}`}
                    className="shrink-0 rounded-md p-2 text-outline transition-colors hover:bg-error/5 hover:text-error disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            ref={fileRef}
            id="brand-asset-files"
            type="file"
            accept={ASSET_CONTENT_TYPES.join(",")}
            multiple
            className="sr-only"
            aria-label="Choose photos to save"
            onChange={(event) => {
              pickFiles(Array.from(event.target.files ?? []))
              event.target.value = ""
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isSaving || assets.length >= MAX_BRAND_ASSETS}
            className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-outline-variant bg-white px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={13} aria-hidden="true" />
            Add photos
          </button>
          <p className="text-[11px] text-outline">
            PNG, JPEG or WEBP, up to {ASSET_MAX_LABEL} each. A photo you remove here stays with the images already made
            from it.
          </p>
        </div>
      </div>
    </Modal>
  )
}
