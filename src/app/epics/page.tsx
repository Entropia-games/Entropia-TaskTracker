"use client"

import { IssueList } from "@/components/issue-list"
import { useIssues } from "@/lib/issues-context"

export default function EpicsPage() {
  const { issues } = useIssues()
  const epics = issues.filter((i) => i.is_epic)
  return <IssueList title="Epics" issues={epics} showTypeFilter={false} />
}
