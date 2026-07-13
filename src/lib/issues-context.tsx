"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react"
import { getSupabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import type { Database } from "@/lib/database.types"

export type IssueStatus = Database["public"]["Enums"]["issue_status"]
export type IssuePriority = Database["public"]["Enums"]["issue_priority"]
export type IssueTeam = Database["public"]["Enums"]["issue_team"]
export type Issue = Database["public"]["Tables"]["issues"]["Row"]

type NewIssueInput = Database["public"]["Tables"]["issues"]["Insert"]

type IssuesContext = {
  issues: Issue[]
  addIssue: (input: NewIssueInput) => Promise<void>
  updateIssue: (id: number, changes: Partial<Issue>) => Promise<void>
  deleteIssues: (ids: number[]) => Promise<void>
  loading: boolean
}

const IssuesContext = createContext<IssuesContext | null>(null)

export function IssuesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const sb = getSupabase()
    sb.from("issues")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setIssues(data)
        setLoading(false)
      })
  }, [user])

  const addIssue = useCallback(async (input: NewIssueInput) => {
    if (!user) return
    const sb = getSupabase()
    const { data, error } = await sb
      .from("issues")
        .insert({
          title: input.title,
          description: input.description,
          status: input.status,
          priority: input.priority,
          team: input.team ?? null,
          is_epic: input.is_epic ?? false,
          parent_epic_id: input.parent_epic_id ?? null,
          due_date: input.due_date,
          assignee_id: input.assignee_id ?? null,
          created_by: user.id,
        })
      .select()
      .single()

    if (error || !data) {
      if (error) console.error("Failed to create issue", JSON.stringify(error, null, 2))
      return
    }

    setIssues((prev) => [data, ...prev])
  }, [user])

  const updateIssue = useCallback(async (id: number, changes: Partial<Issue>) => {
    if (!user) return
    const { error } = await getSupabase()
      .from("issues")
      .update(changes)
      .eq("id", id)
    if (error) {
      console.error("Failed to update issue", JSON.stringify(error))
      return
    }
    setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)))
  }, [user])

  const deleteIssues = useCallback(async (ids: number[]) => {
    if (!user || ids.length === 0) return
    const { error } = await getSupabase()
      .from("issues")
      .delete()
      .in("id", ids)
    if (error) {
      console.error("Failed to delete issues", JSON.stringify(error))
      return
    }
    setIssues((prev) => prev.filter((i) => !ids.includes(i.id)))
  }, [user])

  return (
    <IssuesContext.Provider value={{ issues, addIssue, updateIssue, deleteIssues, loading }}>
      {children}
    </IssuesContext.Provider>
  )
}

export function useIssues() {
  const ctx = useContext(IssuesContext)
  if (!ctx) throw new Error("useIssues must be used within IssuesProvider")
  return ctx
}
