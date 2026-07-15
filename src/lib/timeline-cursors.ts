"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { getSupabase } from "@/lib/supabase"

export type CursorRegion = "grid" | "panel"

export type TimelineCursor = {
  userId: string
  name: string
  color: string
  region: CursorRegion
  x: number
  y: number
  last: number
}

export type TimelineLock = {
  issueId: number
  userId: string
  name: string
  color: string
}

type Me = { id: string; name: string; color: string }

export function useTimelineCursors(projectId: string | number | null | undefined, me: Me | null) {
  const [cursors, setCursors] = useState<Record<string, TimelineCursor>>({})
  const [locks, setLocks] = useState<Record<number, TimelineLock>>({})
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabase>["channel"]> | null>(null)
  const myLocksRef = useRef<Set<number>>(new Set())
  const meRef = useRef(me)
  meRef.current = me

  useEffect(() => {
    if (!me || projectId === null || projectId === undefined) return
    const sb = getSupabase()
    setCursors({})
    setLocks({})

    const channel = sb.channel(`timeline-cursors:${projectId}`, {
      config: { presence: { key: me.id }, broadcast: { self: false } },
    })
    channelRef.current = channel

    channel.on("broadcast", { event: "cursor" }, ({ payload }) => {
      const p = payload as { userId: string; name: string; color: string; region: CursorRegion; x: number; y: number }
      if (p.userId === me.id) return
      setCursors((prev) => ({
        ...prev,
        [p.userId]: { userId: p.userId, name: p.name, color: p.color, region: p.region, x: p.x, y: p.y, last: Date.now() },
      }))
    })

    channel.on("broadcast", { event: "cursor:leave" }, ({ payload }) => {
      const { userId } = payload as { userId: string }
      setCursors((prev) => {
        const n = { ...prev }
        delete n[userId]
        return n
      })
      setLocks((prev) => {
        const n: Record<number, TimelineLock> = {}
        for (const [k, v] of Object.entries(prev)) if (v.userId !== userId) n[Number(k)] = v
        return n
      })
    })

    channel.on("broadcast", { event: "lock" }, ({ payload }) => {
      const l = payload as TimelineLock
      if (l.userId === me.id) return
      setLocks((prev) => ({ ...prev, [l.issueId]: l }))
    })

    channel.on("broadcast", { event: "unlock" }, ({ payload }) => {
      const { issueId } = payload as { issueId: number }
      setLocks((prev) => {
        const n = { ...prev }
        delete n[issueId]
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
      setLocks((prev) => {
        const n: Record<number, TimelineLock> = {}
        for (const [k, v] of Object.entries(prev)) if (online.has(v.userId)) n[Number(k)] = v
        return n
      })
      const cur = meRef.current
      if (cur && myLocksRef.current.size > 0) {
        for (const issueId of myLocksRef.current) {
          channel.send({
            type: "broadcast",
            event: "lock",
            payload: { issueId, userId: cur.id, name: cur.name, color: cur.color },
          } as never)
        }
      }
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
      for (const issueId of myLocksRef.current) {
        channel.send({ type: "broadcast", event: "unlock", payload: { issueId } } as never)
      }
      myLocksRef.current.clear()
      channel.send({ type: "broadcast", event: "cursor:leave", payload: { userId: me.id } } as never)
      sb.removeChannel(channel)
      channelRef.current = null
    }
  }, [projectId, me])

  const sendCursor = useCallback(
    (region: CursorRegion, x: number, y: number) => {
      if (!me) return
      channelRef.current?.send({
        type: "broadcast",
        event: "cursor",
        payload: { userId: me.id, name: me.name, color: me.color, region, x, y },
      } as never)
    },
    [me],
  )

  const lockIssue = useCallback(
    (issueId: number) => {
      if (!me) return
      myLocksRef.current.add(issueId)
      channelRef.current?.send({
        type: "broadcast",
        event: "lock",
        payload: { issueId, userId: me.id, name: me.name, color: me.color },
      } as never)
    },
    [me],
  )

  const unlockIssue = useCallback((issueId: number) => {
    myLocksRef.current.delete(issueId)
    channelRef.current?.send({ type: "broadcast", event: "unlock", payload: { issueId } } as never)
  }, [])

  return { cursors, sendCursor, locks, lockIssue, unlockIssue }
}
