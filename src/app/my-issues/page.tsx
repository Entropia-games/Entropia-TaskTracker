"use client"

import { useIssues } from "@/lib/issues-context"
import { useAuth } from "@/lib/auth-context"
import { IssueList } from "@/components/issue-list"

export default function MyIssuesPage() {
  const { issues } = useIssues()
  const { user } = useAuth()

  const myIssues = user
    ? issues.filter((i) => i.assignee_id === user.id && !i.is_epic)
    : []

  return <IssueList title="My Issues" issues={myIssues} />
}
