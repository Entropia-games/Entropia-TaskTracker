// In-browser image compression using createImageBitmap + OffscreenCanvas.
// Resizes large images and re-encodes (PNG screenshots -> WebP) to cut upload size.

export interface CompressOptions {
  maxSize?: number // max width/height in px, default 1600
  quality?: number // 0..1, default 0.85
  maxFileSizeMB?: number // skip compression below this size, default 1
}

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  const { maxSize = 1600, quality = 0.85, maxFileSizeMB = 1 } = opts

  if (!file.type.startsWith("image/")) return file
  if (file.size <= maxFileSizeMB * 1024 * 1024) return file
  if (typeof OffscreenCanvas === "undefined" || typeof createImageBitmap === "undefined") return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  } catch {
    return file
  }

  try {
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)

    // Screenshots are usually PNG; WebP compresses them far better while keeping text crisp.
    const outputType = file.type === "image/png" ? "image/webp" : file.type
    const blob = await canvas.convertToBlob({ type: outputType, quality })
    const ext = outputType.split("/")[1] || "jpg"
    const baseName = file.name.replace(/\.[^.]+$/, "")
    return new File([blob], `${baseName}.${ext}`, { type: outputType })
  } catch {
    return file
  } finally {
    bitmap.close?.()
  }
}
