"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { getSupabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"

const PresenceContext = createContext<Set<string>>(new Set())

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) {
      setOnlineIds(new Set())
      return
    }
    const sb = getSupabase()
    const channel = sb.channel("global-online", {
      config: { presence: { key: user.id } },
    })
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<string, unknown>
      setOnlineIds(new Set(Object.keys(state)))
    })
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ user_id: user.id })
      }
    })
    return () => {
      sb.removeChannel(channel)
    }
  }, [user])

  return <PresenceContext.Provider value={onlineIds}>{children}</PresenceContext.Provider>
}

export function usePresence() {
  return useContext(PresenceContext)
}
