import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  )
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload))
  const expected = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("")
  return `sha256=${expected}` === signature
}

type GitHubPR = {
  action: string
  pull_request: {
    html_url: string
    title: string
    state: string
    merged: boolean
    body?: string | null
  }
  repository: { full_name: string }
}

export async function POST(req: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 500 })

  const signature = req.headers.get("x-hub-signature-256")
  const body = await req.text()

  if (!signature || !(await verifySignature(body, signature, secret))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 })
  }

  const event = req.headers.get("x-github-event")
  if (event !== "pull_request") return NextResponse.json({ ok: true })

  const payload: GitHubPR = JSON.parse(body)
  const pr = payload.pull_request
  const prUrl = pr.html_url
  const prTitle = pr.title
  const prState = pr.merged ? "merged" : pr.state

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const prText = `${pr.title}\n${pr.body ?? ""}`
  const refRegex = /([A-Z]+)-(\d+)/g
  const refs = new Set<string>()
  let rm: RegExpExecArray | null
  while ((rm = refRegex.exec(prText)) !== null) refs.add(`${rm[1]}-${rm[2]}`)

  const resolvedIds: number[] = []
  for (const ref of refs) {
    const dash = ref.indexOf("-")
    const code = ref.slice(0, dash)
    const num = Number(ref.slice(dash + 1))
    const { data: project } = await sb.from("projects").select("id").eq("code", code).maybeSingle()
    if (!project) continue
    const { data: found } = await sb.from("issues").select("id").eq("display_id", num).eq("project_id", project.id).maybeSingle()
    if (found) resolvedIds.push(found.id)
  }

  const { data: existingLinks } = await sb.from("issue_links").select("id, issue_id").eq("pr_url", prUrl)

  for (const link of existingLinks ?? []) {
    if (!resolvedIds.includes(link.issue_id)) {
      await sb.from("issue_links").delete().eq("id", link.id)
    }
  }

  for (const issueId of resolvedIds) {
    const { data: existingLink } = await sb.from("issue_links").select("id").eq("issue_id", issueId).eq("pr_url", prUrl).maybeSingle()
    if (existingLink) {
      await sb.from("issue_links").update({ pr_state: prState, pr_title: prTitle }).eq("id", existingLink.id)
    } else {
      await sb.from("issue_links").insert({ issue_id: issueId, pr_url: prUrl, pr_title: prTitle, pr_state: prState })
    }
  }

  return NextResponse.json({ ok: true })
}
