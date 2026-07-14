import { UTApi } from "uploadthing/server"

const utapi = new UTApi()

export async function POST(req: Request) {
  let key: unknown
  try {
    const body = (await req.json()) as { key?: unknown }
    key = body?.key
  } catch {
    return new Response("invalid json", { status: 400 })
  }
  if (typeof key !== "string" || !key) {
    return new Response("missing key", { status: 400 })
  }
  try {
    await utapi.deleteFiles(key)
    return new Response(null, { status: 204 })
  } catch (e) {
    console.error("[uploadthing] delete failed:", e)
    return new Response("delete failed", { status: 500 })
  }
}
