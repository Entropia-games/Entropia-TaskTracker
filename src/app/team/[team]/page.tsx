"use client"

import { useParams } from "next/navigation"
import { useIssues } from "@/lib/issues-context"
import { IssueList } from "@/components/issue-list"

export default function TeamPage() {
  const { team } = useParams<{ team: string }>()
  const { issues } = useIssues()

  const teamIssues = team ? issues.filter((i) => i.team === team) : []

  return <IssueList title={team} issues={teamIssues} />
}
