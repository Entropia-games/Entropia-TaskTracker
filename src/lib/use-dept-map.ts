"use client"

import { useEffect, useState } from "react"
import { getSupabase } from "@/lib/supabase"
import { useIssues } from "@/lib/issues-context"
import { normalizeDepartments } from "@/lib/departments"

export function useDeptMap(): Map<string, string[]> {
  const { currentProject } = useIssues()
  const [map, setMap] = useState<Map<string, string[]>>(new Map())

  useEffect(() => {
    if (!currentProject) { setMap(new Map()); return }
    let cancelled = false
    const sb = getSupabase()

    ;(async () => {
      const { data: members } = await sb
        .from("project_members")
        .select("id, user_id, department")
        .eq("project_id", currentProject.id)
      if (cancelled) return

      const memberIds = (members ?? []).map((m) => m.id)
      const byMember = new Map<number, string[]>()
      if (memberIds.length > 0) {
        const { data: rows } = await sb
          .from("project_member_departments")
          .select("member_id, department")
          .in("member_id", memberIds)
        for (const row of rows ?? []) {
          const list = byMember.get(row.member_id) ?? []
          list.push(...normalizeDepartments(row.department))
          byMember.set(row.member_id, list)
        }
      }
      if (cancelled) return

      const next = new Map<string, string[]>()
      for (const member of members ?? []) {
        let depts = byMember.get(member.id) ?? []
        // Fall back to the legacy single-value column until the new table is filled.
        if (depts.length === 0) depts = normalizeDepartments(member.department)
        if (depts.length > 0) next.set(member.user_id, depts)
      }
      setMap(next)
    })()

    return () => { cancelled = true }
  }, [currentProject])

  return map
}
