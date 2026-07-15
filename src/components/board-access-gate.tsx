"use client"

import type { ReactNode } from "react"
import { useAuth } from "@/lib/auth-context"
import { useIssues } from "@/lib/issues-context"

export function BoardAccessGate({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { currentProject, projectsLoaded } = useIssues()

  if (user && projectsLoaded && !currentProject) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">No boards available</p>
      </div>
    )
  }

  return <>{children}</>
}
