import { NextResponse } from "next/server"
import { UTApi } from "uploadthing/server"

const utapi = new UTApi()

type FileInfo = { name: string; size: number }
let cache: { byKey: Map<string, FileInfo>; expiresAt: number } | null = null
let inflight: Promise<Map<string, FileInfo>> | null = null
const CACHE_TTL_MS = 5 * 60 * 1000

function extractFileKey(url: string): string | null {
  const match = url.match(/\/f\/([^?#\s]+)/)
  return match ? match[1] : null
}

async function loadAllFiles(): Promise<Map<string, FileInfo>> {
  const byKey = new Map<string, FileInfo>()
  let offset = 0
  const limit = 100
  for (let page = 0; page < 50; page++) {
    const res = await utapi.listFiles({ limit, offset })
    for (const file of res.files) byKey.set(file.key, { name: file.name, size: file.size })
    if (!res.hasMore || res.files.length === 0) break
    offset += res.files.length
  }
  return byKey
}

async function getFileMap(): Promise<Map<string, FileInfo>> {
  if (cache && cache.expiresAt > Date.now()) return cache.byKey
  if (inflight) return inflight
  inflight = loadAllFiles()
    .then((byKey) => {
      cache = { byKey, expiresAt: Date.now() + CACHE_TTL_MS }
      return byKey
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

export async function POST(req: Request) {
  const { urls } = (await req.json()) as { urls?: string[] }
  if (!urls || urls.length === 0) return NextResponse.json({ info: {} })

  const byKey = await getFileMap()
  const info: Record<string, FileInfo> = {}
  for (const url of urls) {
    const key = extractFileKey(url)
    if (!key) continue
    const file = byKey.get(key)
    if (file) info[url] = file
  }

  return NextResponse.json({ info })
}

