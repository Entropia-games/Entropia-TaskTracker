"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react"
import { getSupabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import type { Database } from "@/lib/database.types"

export type IssueStatus = Database["public"]["Enums"]["issue_status"]
export type IssuePriority = Database["public"]["Enums"]["issue_priority"]
export type IssueTeam = Database["public"]["Enums"]["issue_team"]
export type Issue = Database["public"]["Tables"]["issues"]["Row"]
export type Milestone = Database["public"]["Tables"]["milestones"]["Row"]
export type Project = Database["public"]["Tables"]["projects"]["Row"]

export type Attachment = {
  url: string
  name: string | null
  type: string | null
}

type NewIssueInput = Database["public"]["Tables"]["issues"]["Insert"]

type IssuesContext = {
  issues: Issue[]
  milestones: Milestone[]
  projects: Project[]
  currentProject: Project | null
  setCurrentProject: (p: Project | null) => void
  myRole: string | null
  hasMemberships: boolean
  addIssue: (input: NewIssueInput) => Promise<void>
  updateIssue: (id: number, changes: Partial<Issue>) => Promise<void>
  deleteIssues: (ids: number[]) => Promise<void>
  createMilestone: (name: string, description?: string, target_date?: string) => Promise<void>
  updateMilestone: (id: number, changes: Partial<Milestone>) => Promise<void>
  deleteMilestone: (id: number) => Promise<void>
  loading: boolean
  projectsLoaded: boolean
}

const IssuesContext = createContext<IssuesContext | null>(null)

const PROJECT_STORAGE_KEY = "lin_current_project_id"

export function IssuesProvider({ children }: { children: ReactNode }) {
  const { user, username } = useAuth()
  const [issues, setIssues] = useState<Issue[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [memberRoles, setMemberRoles] = useState<Record<number, string>>({})
  const [hasMemberships, setHasMemberships] = useState(false)
  const [myRole, setMyRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [projectsLoaded, setProjectsLoaded] = useState(false)

  useEffect(() => {
    if (!user) return
    const sb = getSupabase()
    ;(async () => {
      const { data } = await sb.from("projects").select("*").order("id")
      if (!data) { setProjectsLoaded(true); return }
      let rows = data as Project[]

      // Scope visible projects strictly to this user's memberships (configured in
      // the DB). A user only sees a project if they have a project_members row for
      // it. No memberships => no projects (and no admin/desk access).
      const { data: mem } = await sb
        .from("project_members")
        .select("project_id, role")
        .eq("user_id", user.id)
      const ids = (mem ?? []).map((m) => m.project_id)
      const rolesById: Record<number, string> = {}
      for (const m of mem ?? []) rolesById[m.project_id] = m.role
      setMemberRoles(rolesById)
      setHasMemberships(ids.length > 0)
      const idSet = new Set(ids)
      rows = rows.filter((p) => idSet.has(p.id))

      setProjects(rows)
      const storedId = localStorage.getItem(PROJECT_STORAGE_KEY)
      const saved = storedId ? rows.find((p) => p.id === Number(storedId)) : null
      setCurrentProject(saved ?? rows[0] ?? null)
      setProjectsLoaded(true)
    })()
  }, [user])

  useEffect(() => {
    if (!currentProject) { setMyRole(null); return }
    setMyRole(memberRoles[currentProject.id] ?? null)
  }, [currentProject, memberRoles])

  useEffect(() => {
    if (!user) return
    if (!currentProject) { setLoading(false); return }
    const sb = getSupabase()
    sb.from("issues")
      .select("*")
      .eq("project_id", currentProject.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setIssues(data)
        setLoading(false)
      })
    sb.from("milestones")
      .select("*")
      .eq("project_id", currentProject.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setMilestones(data)
      })
  }, [user, currentProject])

  useEffect(() => {
    if (!user || !currentProject) return
    const sb = getSupabase()
    const projectId = currentProject.id
    const filter = `project_id=eq.${projectId}`

    const upsertBy = <T extends { id: number }>(row: T) => (prev: T[]) => {
      const idx = prev.findIndex((r) => r.id === row.id)
      if (idx === -1) return [row, ...prev]
      const next = [...prev]
      next[idx] = row
      return next
    }

    const channel = sb
      .channel(`project-changes-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "issues", filter },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldId = (payload.old as { id: number }).id
            setIssues((prev) => prev.filter((i) => i.id !== oldId))
          } else {
            setIssues(upsertBy(payload.new as Issue))
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "milestones", filter },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldId = (payload.old as { id: number }).id
            setMilestones((prev) => prev.filter((m) => m.id !== oldId))
          } else {
            setMilestones(upsertBy(payload.new as Milestone))
          }
        },
      )
      .subscribe()

    return () => {
      sb.removeChannel(channel)
    }
  }, [user, currentProject])

  const setCurrentProjectAndSave = useCallback((p: Project | null) => {
    setCurrentProject(p)
    if (p) localStorage.setItem(PROJECT_STORAGE_KEY, String(p.id))
    else localStorage.removeItem(PROJECT_STORAGE_KEY)
  }, [])

  const addIssue = useCallback(async (input: NewIssueInput) => {
    if (!user || !currentProject) return
    const sb = getSupabase()
    const creatorName = username ?? (await sb.from("users").select("name").eq("id", user.id).single()).data?.name ?? "Unknown"
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
          milestone_id: input.milestone_id ?? null,
          due_date: input.due_date,
          assignee_id: input.assignee_id ?? null,
          created_by: creatorName,
          project_id: currentProject.id,
          attachments: (input.attachments ?? []) as Issue["attachments"],
        })
      .select()
      .single()

    if (error || !data) {
      if (error) console.error("Failed to create issue", JSON.stringify(error, null, 2))
      return
    }

    setIssues((prev) => [data, ...prev])
  }, [user, username, currentProject])

  const updateIssue = useCallback(async (id: number, changes: Partial<Issue>) => {
    if (!user) return
    setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)))
    const { error } = await getSupabase()
      .from("issues")
      .update(changes)
      .eq("id", id)
    if (error) {
      console.error("Failed to update issue", JSON.stringify(error))
    }
  }, [user])

  const deleteIssues = useCallback(async (ids: number[]) => {
    if (!user || ids.length === 0) return

    const { data: issues } = await getSupabase()
      .from("issues")
      .select("description, attachments")
      .in("id", ids)
    if (issues) {
      const urls: string[] = []
      for (const iss of issues) {
        if (iss.description) {
          const re = /!\[.*?\]\((.*?)\)/g
          let m: RegExpExecArray | null
          while ((m = re.exec(iss.description)) !== null) {
            urls.push(m[1])
          }
        }
        const atts = iss.attachments as unknown
        if (Array.isArray(atts)) {
          for (const a of atts) {
            if (typeof a === "string") urls.push(a)
            else if (a && typeof a === "object" && "url" in a) urls.push((a as Attachment).url)
          }
        }
      }
      if (urls.length > 0) {
        fetch("/api/delete-images", { method: "POST", body: JSON.stringify({ urls }) })
          .catch((e) => console.error("Failed to delete images", e))
      }
    }

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

  const createMilestone = useCallback(async (name: string, description?: string, target_date?: string) => {
    if (!user || !currentProject) return
    const { data, error } = await getSupabase().from("milestones").insert({ name, description, target_date, project_id: currentProject.id }).select().single()
    if (error || !data) { console.error("Failed to create milestone", JSON.stringify(error)); return }
    setMilestones((prev) => [data, ...prev])
  }, [user, currentProject])

  const updateMilestone = useCallback(async (id: number, changes: Partial<Milestone>) => {
    if (!user) return
    const { error } = await getSupabase().from("milestones").update(changes).eq("id", id)
    if (error) { console.error("Failed to update milestone", JSON.stringify(error)); return }
    setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, ...changes } : m)))
  }, [user])

  const deleteMilestone = useCallback(async (id: number) => {
    if (!user) return
    const { error: clearError } = await getSupabase().from("issues").update({ milestone_id: null }).eq("milestone_id", id)
    if (clearError) { console.error("Failed to clear milestone on issues", JSON.stringify(clearError)); return }
    const { error } = await getSupabase().from("milestones").delete().eq("id", id)
    if (error) { console.error("Failed to delete milestone", JSON.stringify(error)); return }
    setMilestones((prev) => prev.filter((m) => m.id !== id))
    setIssues((prev) => prev.map((i) => i.milestone_id === id ? { ...i, milestone_id: null } : i))
  }, [user])

  return (
    <IssuesContext.Provider value={{ issues, milestones, projects, currentProject, setCurrentProject: setCurrentProjectAndSave, myRole, hasMemberships, addIssue, updateIssue, deleteIssues, createMilestone, updateMilestone, deleteMilestone, loading, projectsLoaded }}>
      {children}
    </IssuesContext.Provider>
  )
}

export function useIssues() {
  const ctx = useContext(IssuesContext)
  if (!ctx) throw new Error("useIssues must be used within IssuesProvider")
  return ctx
}
