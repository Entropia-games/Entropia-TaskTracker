"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { getSupabase } from "@/lib/supabase"

export type TimelineCursor = {
  userId: string
  name: string
  color: string
  x: number
  y: number
  last: number
}

type Me = { id: string; name: string; color: string }

export function useTimelineCursors(projectId: string | number | null | undefined, me: Me | null) {
  const [cursors, setCursors] = useState<Record<string, TimelineCursor>>({})
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabase>["channel"]> | null>(null)

  useEffect(() => {
    if (!me || projectId === null || projectId === undefined) return
    const sb = getSupabase()
    setCursors({})

    const channel = sb.channel(`timeline-cursors:${projectId}`, {
      config: { presence: { key: me.id }, broadcast: { self: false } },
    })
    channelRef.current = channel

    channel.on("broadcast", { event: "cursor" }, ({ payload }) => {
      const p = payload as { userId: string; name: string; color: string; x: number; y: number }
      if (p.userId === me.id) return
      setCursors((prev) => ({
        ...prev,
        [p.userId]: { userId: p.userId, name: p.name, color: p.color, x: p.x, y: p.y, last: Date.now() },
      }))
    })

    channel.on("broadcast", { event: "cursor:leave" }, ({ payload }) => {
      const { userId } = payload as { userId: string }
      setCursors((prev) => {
        const n = { ...prev }
        delete n[userId]
        return n
      })
    })

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<{ userId: string }>()
      const online = new Set<string>()
      Object.values(state).forEach((list) => list.forEach((m) => online.add(m.userId)))
      setCursors((prev) => {
        const n: Record<string, TimelineCursor> = {}
        for (const [k, v] of Object.entries(prev)) if (online.has(k)) n[k] = v
        return n
      })
    })

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ userId: me.id })
      }
    })

    const prune = setInterval(() => {
      const now = Date.now()
      setCursors((prev) => {
        let changed = false
        const n: Record<string, TimelineCursor> = {}
        for (const [k, v] of Object.entries(prev)) {
          if (now - v.last < 8000) n[k] = v
          else changed = true
        }
        return changed ? n : prev
      })
    }, 3000)

    return () => {
      clearInterval(prune)
      channel.send({ type: "broadcast", event: "cursor:leave", payload: { userId: me.id } } as never)
      sb.removeChannel(channel)
      channelRef.current = null
    }
  }, [projectId, me])

  const sendCursor = useCallback(
    (x: number, y: number) => {
      if (!me) return
      channelRef.current?.send({
        type: "broadcast",
        event: "cursor",
        payload: { userId: me.id, name: me.name, color: me.color, x, y },
      } as never)
    },
    [me],
  )

  return { cursors, sendCursor }
}
