/**
 * Full cleanup: re-upload ALL images through Uploadthing with compression.
 *
 * Usage: npx tsx --env-file=.env.local scripts/compress-existing-images.ts
 */

import { createClient } from "@supabase/supabase-js"
import { UTApi } from "uploadthing/server"

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const utapi = new UTApi({ token: process.env.UPLOADTHING_TOKEN })

const imagePattern = /!\[.*?\]\((.*?)\)/g
const utKeyPattern = /\/f\/([a-zA-Z0-9]+)/

async function compressBuffer(buf: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default
  let img = sharp(buf)
  const meta = await img.metadata()
  const w = meta.width && meta.width > 1600 ? 1600 : undefined
  let quality = 80
  let result = await img.resize({ width: w, withoutEnlargement: true }).jpeg({ quality }).toBuffer()
  while (result.length > 300 * 1024 && quality > 10) {
    quality -= 10
    result = await sharp(buf).resize({ width: w, withoutEnlargement: true }).jpeg({ quality }).toBuffer()
  }
  return result
}

async function main() {
  console.log("Fetching documents...")
  const { data: docs, error } = await sb.from("documents").select("id, title, content").not("content", "eq", "")
  if (error || !docs) {
    console.error("Failed:", error)
    return
  }
  console.log(`Found ${docs.length} documents\n`)

  const oldKeysToDelete: string[] = []
  let total = 0

  for (const doc of docs) {
    const content = doc.content ?? ""
    const matches = [...content.matchAll(imagePattern)]
    if (matches.length === 0) continue

    let updatedContent = content
    let changed = false

    for (const match of matches) {
      const url = match[1]
      total++

      try {
        let buf: Buffer

        if (url.startsWith("data:image")) {
          // base64
          const [, data] = url.split(",")
          buf = Buffer.from(data, "base64")
          console.log(`  [${doc.title}] base64 (${(buf.length / 1024).toFixed(0)}KB)`)
        } else if (url.includes("ufs.io") || url.includes("ufs.sh") || url.includes("uploadthing")) {
          // Uploadthing
          const res = await fetch(url)
          if (!res.ok) { console.log(`  [${doc.title}] SKIP fetch failed ${url.slice(0, 60)}`); continue }
          buf = Buffer.from(await res.arrayBuffer())
          console.log(`  [${doc.title}] ut (${(buf.length / 1024).toFixed(0)}KB) ${url.slice(-30)}`)

          // Collect old key for deletion
          const km = url.match(utKeyPattern)
          if (km) oldKeysToDelete.push(km[1])
        } else {
          console.log(`  [${doc.title}] SKIP external ${url.slice(0, 60)}`)
          continue
        }

        const compressed = await compressBuffer(buf)
        // If compressed is larger, keep original
        if (compressed.length >= buf.length) {
          console.log(`    = ${buf.length === compressed.length ? "same" : `${(buf.length / 1024).toFixed(0)}KB → ${(compressed.length / 1024).toFixed(0)}KB (bigger, keeping original)`}`)
          // Remove old key from deletion list since we're keeping it
          if (!url.startsWith("data:")) {
            const km = url.match(utKeyPattern)
            if (km) oldKeysToDelete.pop()
          }
          continue
        }
        const file = new File([new Uint8Array(compressed)], `doc${doc.id}-${total}.jpg`, { type: "image/jpeg" })
        const uploadRes = await utapi.uploadFiles([file])
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const newUrl = (uploadRes[0] as any)?.data?.ufsUrl as string | undefined

        if (newUrl) {
          updatedContent = updatedContent.replace(url, newUrl)
          changed = true
          const fromKB = (buf.length / 1024).toFixed(0)
          const toKB = (compressed.length / 1024).toFixed(0)
          console.log(`    ✓ ${fromKB}KB → ${toKB}KB`)
        } else {
          console.log(`    ✗ upload returned no URL`)
        }
      } catch (e) {
        console.error(`    ✗ failed:`, e)
      }
    }

    if (changed) {
      await sb.from("documents").update({ content: updatedContent }).eq("id", doc.id)
      console.log(`  → saved "${doc.title}"\n`)
    }
  }

  // Delete all old Uploadthing files
  if (oldKeysToDelete.length > 0) {
    console.log(`\nDeleting ${oldKeysToDelete.length} old files from Uploadthing...`)
    for (let i = 0; i < oldKeysToDelete.length; i += 50) {
      const batch = oldKeysToDelete.slice(i, i + 50)
      await utapi.deleteFiles(batch)
    }
    console.log("Done deleting.")
  }

  console.log(`\nTotal images processed: ${total}`)
}

main().catch(console.error)
