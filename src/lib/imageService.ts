/**
 * Recipe image upload service.
 *
 * Resizes and compresses images client-side before uploading to Supabase
 * Storage. Works offline: when Supabase is unavailable the image is encoded as
 * a data URL and stored inline in the recipe.
 *
 * Storage layout: recipe-images/{userId}/{recipeId}/original.webp
 *                 recipe-images/{userId}/{recipeId}/thumb.webp
 */

import { supabase } from './supabase'

const BUCKET = 'recipe-images'

/** Max dimension (px) for the full-size image. */
const MAX_FULL_PX = 1200
/** Max dimension (px) for the thumbnail. */
const MAX_THUMB_PX = 400
/** WebP quality (0–1). */
const QUALITY = 0.82
/** Max input file size the user may select (bytes). */
export const MAX_INPUT_BYTES = 20 * 1024 * 1024 // 20 MB

export interface UploadedImage {
  /** Public URL of the full-size image. */
  url: string
  /** Public URL of the thumbnail. */
  thumbnailUrl: string
}

// ─── Canvas helpers ───────────────────────────────────────────────────────────

/** Resize an image file to fit within maxDim × maxDim, return a WebP Blob. */
function resizeToBlob(file: File, maxDim: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      const { width, height } = img
      const scale = Math.min(1, maxDim / Math.max(width, height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)

      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Could not get 2D canvas context'))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error('canvas.toBlob returned null — browser may not support WebP')),
        'image/webp',
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image for resizing'))
    }

    img.src = objectUrl
  })
}

// ─── Local fallback ───────────────────────────────────────────────────────────

/** Read a File as a data URL (used when Supabase is not available). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('FileReader failed'))
    reader.readAsDataURL(file)
  })
}

/** Resize a file and return a data URL (offline thumbnail substitute). */
export async function resizeToDataUrl(file: File, maxDim: number): Promise<string> {
  const blob = await resizeToBlob(file, maxDim, QUALITY)
  return fileToDataUrl(new File([blob], 'image.webp', { type: 'image/webp' }))
}

// ─── Supabase Storage upload ──────────────────────────────────────────────────

/**
 * Upload a recipe image to Supabase Storage.
 * Resizes client-side to full (1200px) and thumbnail (400px) before upload.
 *
 * @throws if Supabase is not configured, or if the upload fails.
 */
export async function uploadRecipeImage(
  userId: string,
  recipeId: string,
  file: File
): Promise<UploadedImage> {

  const [fullBlob, thumbBlob] = await Promise.all([
    resizeToBlob(file, MAX_FULL_PX, QUALITY),
    resizeToBlob(file, MAX_THUMB_PX, QUALITY),
  ])

  const fullPath = `${userId}/${recipeId}/original.webp`
  const thumbPath = `${userId}/${recipeId}/thumb.webp`

  const [fullResult, thumbResult] = await Promise.all([
    supabase.storage.from(BUCKET).upload(fullPath, fullBlob, {
      contentType: 'image/webp',
      upsert: true,
    }),
    supabase.storage.from(BUCKET).upload(thumbPath, thumbBlob, {
      contentType: 'image/webp',
      upsert: true,
    }),
  ])

  if (fullResult.error) throw fullResult.error
  if (thumbResult.error) throw thumbResult.error

  const { data: fullUrlData } = supabase.storage.from(BUCKET).getPublicUrl(fullPath)
  const { data: thumbUrlData } = supabase.storage.from(BUCKET).getPublicUrl(thumbPath)

  return {
    url: fullUrlData.publicUrl,
    thumbnailUrl: thumbUrlData.publicUrl,
  }
}

/**
 * Delete all stored images for a recipe.
 * Safe to call when Supabase is unavailable (no-op).
 */
export async function deleteRecipeImages(userId: string, recipeId: string): Promise<void> {
  await supabase.storage
    .from(BUCKET)
    .remove([`${userId}/${recipeId}/original.webp`, `${userId}/${recipeId}/thumb.webp`])
}

/**
 * Check whether a URL is a Supabase Storage URL for the recipe-images bucket.
 * Used to decide whether to clean up storage on recipe deletion.
 */
export function isStorageUrl(url: string | undefined): boolean {
  if (!url) return false
  return url.includes('/storage/v1/object/public/recipe-images/')
}
