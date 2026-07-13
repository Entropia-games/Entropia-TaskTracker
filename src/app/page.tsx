"use client"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { IssueList } from "@/components/issue-list"
import { useIssues } from "@/lib/issues-context"

function HomeInner() {
  const { issues } = useIssues()
  const sp = useSearchParams()
  const focusId = sp.get("issue") ? Number(sp.get("issue")) : undefined
  return <IssueList title="All Issues" issues={issues} focusId={focusId} />
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeInner />
    </Suspense>
  )
}
