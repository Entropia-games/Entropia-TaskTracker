"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import { getSupabase } from "@/lib/supabase"
import type { AuthUser } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

type AuthContext = {
  user: AuthUser | null
  username: string | null
  loading: boolean
  signIn: (nickname: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContext | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const ensureProfile = useCallback(async (u: AuthUser) => {
    const name = u.user_metadata?.name as string | undefined
    const payload: Database["public"]["Tables"]["users"]["Insert"] = { id: u.id, email: u.email ?? "" }
    if (name) payload.name = name
    await getSupabase().from("users").upsert(payload)
    const { data: profile } = await getSupabase()
      .from("users")
      .select("name")
      .eq("id", u.id)
      .single()
    return profile?.name ?? null
  }, [])

  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    const sb = getSupabase()
    sb.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user ?? null
      setUser(u)
      if (u) {
        const name = await ensureProfile(u)
        setUsername(name)
      }
      setLoading(false)
    })

    const { data: listener } = sb.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        const name = await ensureProfile(u)
        setUsername(name)
      } else {
        setUsername(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [ensureProfile])

  const signIn = useCallback(async (nickname: string, password: string) => {
    const sb = getSupabase()
    const { data: email, error: lookupError } = await sb.rpc("get_email_by_nickname", {
      nickname,
    })
    if (lookupError) {
      console.error("Lookup error", JSON.stringify(lookupError))
      return "User not found"
    }
    if (!email) return "User not found"
    const result = await sb.auth.signInWithPassword({ email, password })
    if (result.error) console.error("Sign in error", JSON.stringify(result.error))
    return result.error?.message ?? null
  }, [])

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, username, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
