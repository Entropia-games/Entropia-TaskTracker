"use client"

import { useEffect, useState } from "react"
import { getSupabase } from "@/lib/supabase"
import { useIssues } from "@/lib/issues-context"

export function useDeptMap(): Map<string, string> {
  const { currentProject } = useIssues()
  const [map, setMap] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (!currentProject) { setMap(new Map()); return }
    getSupabase()
      .from("project_members")
      .select("user_id, department")
      .eq("project_id", currentProject.id)
      .then(({ data }) => {
        const m = new Map<string, string>()
        for (const row of data ?? []) {
          if (row.department) m.set(row.user_id, row.department)
        }
        setMap(m)
      })
  }, [currentProject])

  return map
}
