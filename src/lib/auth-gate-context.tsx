"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import { useAuth } from "@/lib/auth-context"
import { AuthDialog } from "@/components/auth-dialog"

type AuthGateContextValue = {
  requireAuth: (action: () => void) => void
}

const AuthGateContext = createContext<AuthGateContextValue | null>(null)

export function AuthGateProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<(() => void) | null>(null)

  const requireAuth = useCallback(
    (action: () => void) => {
      if (user) {
        action()
      } else {
        setPending(() => action)
        setOpen(true)
      }
    },
    [user],
  )

  const handleOpenChange = useCallback((v: boolean) => {
    setOpen(v)
    if (!v) setPending(null)
  }, [])

  const handleSignedIn = useCallback(() => {
    setOpen(false)
    const action = pending
    setPending(null)
    if (action) action()
  }, [pending])

  return (
    <AuthGateContext.Provider value={{ requireAuth }}>
      {children}
      <AuthDialog open={open} onOpenChange={handleOpenChange} onSignedIn={handleSignedIn} gate />
    </AuthGateContext.Provider>
  )
}

export function useAuthGate() {
  const ctx = useContext(AuthGateContext)
  if (!ctx) throw new Error("useAuthGate must be used within AuthGateProvider")
  return ctx
}
