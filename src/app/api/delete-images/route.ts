import { NextResponse } from "next/server"
import { UTApi } from "uploadthing/server"

const utapi = new UTApi()

function extractFileKeys(urls: string[]): string[] {
  return urls
    .map((url) => {
      const match = url.match(/\/f\/([^?#\s]+)/)
      return match ? match[1] : null
    })
    .filter((k): k is string => k !== null)
}

export async function POST(req: Request) {
  const { urls } = await req.json() as { urls: string[] }
  if (!urls || urls.length === 0) return NextResponse.json({ ok: true })
  const keys = extractFileKeys(urls)
  if (keys.length === 0) return NextResponse.json({ ok: true })
  await utapi.deleteFiles(keys)
  return NextResponse.json({ ok: true })
}
