"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"

type NavigationLoadingContextValue = {
  startNavigation: (href: string) => void
}

const NavigationLoadingContext = createContext<NavigationLoadingContextValue>({
  startNavigation: () => {},
})

export function useNavigationLoading() {
  return useContext(NavigationLoadingContext)
}

function normalizePath(href: string) {
  try {
    return new URL(href, "http://x").pathname
  } catch {
    return href
  }
}

type NavigationLoadingState = {
  pendingPath: string | null
}

const NavigationLoadingStateContext = createContext<NavigationLoadingState>({ pendingPath: null })

export function NavigationLoadingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [pendingPath, setPendingPath] = useState<string | null>(null)

  useEffect(() => {
    setPendingPath(null)
  }, [pathname])

  const startNavigation = useCallback((href: string) => {
    const next = normalizePath(href)
    if (next === pathname) return
    setPendingPath(next)
  }, [pathname])

  return (
    <NavigationLoadingContext.Provider value={{ startNavigation }}>
      <NavigationLoadingStateContext.Provider value={{ pendingPath }}>
        {children}
      </NavigationLoadingStateContext.Provider>
    </NavigationLoadingContext.Provider>
  )
}

export function NavigationLoadingContent({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { pendingPath } = useContext(NavigationLoadingStateContext)
  const isNavigating = pendingPath !== null && pendingPath !== pathname

  if (isNavigating) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return <>{children}</>
}
