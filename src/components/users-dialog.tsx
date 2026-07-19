"use client"

import { useEffect, useState } from "react"
import { Users as UsersIcon } from "lucide-react"
import { getSupabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { useIssues } from "@/lib/issues-context"
import { usePresence } from "@/lib/presence-context"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { SidebarMenuButton } from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn, userAvatarColor } from "@/lib/utils"

type Member = {
  id: string
  name: string | null
  display_name: string | null
  avatar_url: string | null
  role: string | null
}

export function UsersDialog() {
  const { user } = useAuth()
  const { currentProject } = useIssues()
  const onlineIds = usePresence()
  const [members, setMembers] = useState<Member[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open || !currentProject) return
    const sb = getSupabase()
    ;(async () => {
      const { data: pm } = await sb
        .from("project_members")
        .select("user_id, role")
        .eq("project_id", currentProject.id)
      const ids = (pm ?? []).map((m) => m.user_id)
      if (ids.length === 0) {
        setMembers([])
        return
      }
      const { data: us } = await sb
        .from("users")
        .select("id, name, display_name, avatar_url")
        .in("id", ids)
      const roleById = new Map((pm ?? []).map((m) => [m.user_id, m.role]))
      setMembers(
        (us ?? []).map((u) => ({
          id: u.id,
          name: u.name,
          display_name: u.display_name,
          avatar_url: u.avatar_url,
          role: roleById.get(u.id) ?? null,
        }))
      )
    })()
  }, [open, currentProject])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <SidebarMenuButton tooltip="Members">
            <UsersIcon />
            <span>Members</span>
          </SidebarMenuButton>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Members</DialogTitle>
        <DialogDescription>
          {members.length} {members.length === 1 ? "member" : "members"}
        </DialogDescription>
        <div className="mt-2 flex max-h-[60vh] flex-col gap-1 overflow-auto">
          {members.map((m) => {
            const online = onlineIds.has(m.id)
            const label = m.name ?? m.display_name ?? "Unknown"
            const initials = label.slice(0, 2).toUpperCase()
            return (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent"
              >
                <div className="relative shrink-0">
                  <Avatar>
                    {m.avatar_url ? <AvatarImage src={m.avatar_url} alt={label} /> : null}
                    <AvatarFallback className={userAvatarColor(m.name ?? "")}>{initials}</AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      "absolute bottom-0 left-0 size-2.5 rounded-full ring-2 ring-background",
                      online ? "bg-green-500" : "bg-neutral-500"
                    )}
                  />
                </div>
                <div className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span className="truncate text-sm font-medium">{m.name ?? "Unknown"}</span>
                  {m.display_name ? (
                    <span className="truncate text-xs text-muted-foreground">{m.display_name}</span>
                  ) : null}
                </div>
              </div>
            )
          })}
          {members.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              No members in this project
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
