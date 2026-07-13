import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret")
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { nickname, password } = await req.json()
  if (!nickname || !password) {
    return NextResponse.json({ error: "nickname and password required" }, { status: 400 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const email = `${nickname}@local.lin`

  const { data: userData, error: createError } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: nickname },
  })
  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 })
  }

  const { error: profileError } = await sb.from("users").upsert({
    id: userData.user.id,
    email,
    name: nickname,
  })
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
