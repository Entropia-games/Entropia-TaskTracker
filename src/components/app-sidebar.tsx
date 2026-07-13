"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { useState, useCallback, useEffect, useRef } from "react"
import { SearchModal } from "@/components/search-modal"
import { useRouter, usePathname } from "next/navigation"
import {
  List,
  CircleDot,
  LayoutGrid,
  BarChart3,
  Search,
  LogOut,
  LogIn,
  ChevronDown,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useIssues } from "@/lib/issues-context"
import { AuthDialog } from "@/components/auth-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

const teams = [
  { label: "ART", color: "text-red-400" },
  { label: "DEV", color: "text-blue-400" },
  { label: "QA", color: "text-white/80" },
  { label: "GD", color: "text-yellow-400" },
  { label: "Sound", color: "text-orange-400" },
]

type NavItem = {
  label: string
  icon: typeof List
  href: string
  count?: number
}

const navItems: NavItem[] = [
  { label: "All Issues", icon: List, href: "/" },
  { label: "My Issues", icon: CircleDot, href: "/my-issues" },
  { label: "Epics", icon: LayoutGrid, href: "/epics" },
  { label: "Statistics", icon: BarChart3, href: "/statistics" },
]

export function AppSidebar() {
  const { user, username, signOut } = useAuth()
  const { projects, currentProject, setCurrentProject } = useIssues()
  const [projectPopoverOpen, setProjectPopoverOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen(true) }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const navigate = useCallback((href: string) => {
    if (href !== "#") router.push(href)
  }, [router])

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-3">
        <Popover open={projectPopoverOpen} onOpenChange={setProjectPopoverOpen}>
          <PopoverTrigger
            render={
              <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent transition-colors">
                <span className="flex size-5 items-center justify-center rounded bg-sidebar-accent text-[10px] font-semibold text-sidebar-accent-foreground shrink-0">
                  {currentProject?.code?.[0] ?? "P"}
                </span>
                <span className="flex-1 truncate text-left group-data-[collapsible=icon]:hidden">
                  {currentProject?.name ?? "Projects"}
                </span>
                <ChevronDown className="size-3 text-muted-foreground group-data-[collapsible=icon]:hidden" />
              </button>
            }
          />
          <PopoverContent className="w-48 p-1" align="start" sideOffset={4}>
            {projects.map((p) => (
              <button
                key={p.id}
                className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent", currentProject?.id === p.id ? "text-foreground font-medium" : "text-muted-foreground")}
                onClick={() => { setCurrentProject(p); setProjectPopoverOpen(false) }}
              >
                <span className="flex size-5 items-center justify-center rounded bg-sidebar-accent text-[10px] font-semibold text-sidebar-accent-foreground">{p.code[0]}</span>
                <span className="text-xs font-mono text-muted-foreground/60">{p.code}</span>
                <span className="flex-1 truncate">{p.name}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton
                    tooltip={item.label}
                    isActive={pathname === item.href}
                    onClick={() => navigate(item.href)}
                  >
                    <span className="flex items-center gap-2">
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </span>
                    {item.count !== undefined && (
                      <span className="text-[11px] text-muted-foreground">{item.count}</span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel>Teams</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {teams.map((t) => (
                <SidebarMenuItem key={t.label}>
                  <SidebarMenuButton
                    tooltip={t.label}
                    isActive={pathname === `/team/${t.label}`}
                    onClick={() => navigate(`/team/${t.label}`)}
                  >
                    <span className="flex items-center gap-2">
                      <span className={cn("flex size-4 items-center justify-center rounded text-[9px] font-medium", t.color)}>{(t.label === "Sound" ? "S" : t.label)[0]}</span>
                      <span>{t.label}</span>
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border pb-3">
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Search (Ctrl+K)" onClick={() => setSearchOpen(true)}>
              <span className="flex items-center gap-2 text-muted-foreground">
                <Search className="size-4" />
                <span className="group-data-[collapsible=icon]:hidden text-sm">Search</span>
                <kbd className="ml-auto hidden text-[10px] text-muted-foreground group-data-[collapsible=icon]:hidden md:inline-flex items-center gap-0.5 rounded border border-border px-1.5 py-0.5 font-mono">
                  <span>⌘</span>K
                </kbd>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {user ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={username ?? "Account"}
                onClick={() => signOut()}
              >
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Avatar className="size-5">
                    <AvatarFallback className="text-[10px]">
                      {(username ?? "U")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate group-data-[collapsible=icon]:hidden text-sm">
                    {username}
                  </span>
                  <LogOut className="size-3.5 group-data-[collapsible=icon]:hidden" />
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : (
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Sign in" onClick={() => setAuthOpen(true)}>
                <span className="flex items-center gap-2 text-muted-foreground">
                  <LogIn className="size-4" />
                  <span className="group-data-[collapsible=icon]:hidden text-sm">Sign in</span>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
        <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
      </SidebarFooter>
    </Sidebar>
  )
}
