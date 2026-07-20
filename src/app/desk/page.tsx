"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, Pencil, X } from "lucide-react"
import { getSupabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { useIssues } from "@/lib/issues-context"
import { Whiteboard } from "@/components/board/whiteboard"
import type { Me } from "@/lib/board/types"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const PALETTE = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#eab308"]

function colorFor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

type BoardRow = { id: string; name: string }

export default function DeskPage() {
  const { user, username, displayName, loading } = useAuth()
  const { myRole } = useIssues()
  const [boards, setBoards] = useState<BoardRow[]>([])
  const [boardId, setBoardId] = useState<string>("")
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BoardRow | null>(null)
  const [renameTarget, setRenameTarget] = useState<BoardRow | null>(null)
  const [renameValue, setRenameValue] = useState("")

  const me: Me | null = useMemo(() => {
    if (!user) return null
    const name = displayName || username || user.email || "Anon"
    return { id: user.id, name, color: colorFor(user.id) }
  }, [user, username, displayName])

  useEffect(() => {
    getSupabase()
      .from("boards")
      .select("id,name")
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        const rows = (data as BoardRow[] | null) ?? []
        setBoards(rows)
        setBoardId((prev) => (rows.some((r) => r.id === prev) ? prev : (rows[0]?.id ?? "")))
      })
  }, [])

  const createBoard = async () => {
    const id = Math.random().toString(36).slice(2, 8)
    const name = `Board ${boards.length + 1}`
    await getSupabase().from("boards").upsert({ id, name, data: { strokes: [], cards: [] } })
    setBoards((prev) => [{ id, name }, ...prev])
    setBoardId(id)
  }

  const deleteBoard = async (id: string) => {
    const { error } = await getSupabase().from("boards").delete().eq("id", id)
    if (error) console.error("[board] delete failed:", error.message)
    const remaining = boards.filter((b) => b.id !== id)
    setBoards(remaining)
    if (boardId === id) setBoardId(remaining[0]?.id ?? "")
  }

  const openRename = (b: BoardRow) => {
    setPopoverOpen(false)
    setRenameTarget(b)
    setRenameValue(b.name)
  }

  const applyRename = async () => {
    if (!renameTarget) return
    const name = renameValue.trim()
    if (!name) return
    const { error } = await getSupabase().from("boards").update({ name }).eq("id", renameTarget.id)
    if (error) console.error("[board] rename failed:", error.message)
    setBoards((prev) => prev.map((b) => (b.id === renameTarget.id ? { ...b, name } : b)))
    setRenameTarget(null)
  }

  if (loading) return <div className="p-6 text-neutral-400">Loading…</div>
  if (!user) return <div className="p-6 text-neutral-400">Sign in to use the desk.</div>
  if (!me) return null
  if (myRole !== "admin" && myRole !== "member") return <div className="p-6 text-neutral-400">Access denied.</div>

  const list: BoardRow[] = boards
  const currentName = list.find((b) => b.id === boardId)?.name ?? (boardId || "—")

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900 px-4 py-2 text-sm">
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger className="flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1 text-neutral-100 hover:bg-neutral-700">
            <span className="text-neutral-400">Desk:</span>
            <span className="font-medium">{currentName}</span>
            <ChevronDown className="size-4 text-neutral-400" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-1">
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Boards
              </span>
              <Button size="xs" onClick={createBoard}>
                + New
              </Button>
            </div>
            <div className="flex flex-col">
              {list.map((b) => {
                const active = b.id === boardId
                return (
                  <div
                    key={b.id}
                    className={`group flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-neutral-800 ${
                      active ? "bg-neutral-800" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setBoardId(b.id)
                        setPopoverOpen(false)
                      }}
                      className="flex-1 truncate text-left text-neutral-100"
                    >
                      {b.name}
                      {active && <span className="ml-2 text-xs text-neutral-500">current</span>}
                    </button>
                    <button
                      type="button"
                      aria-label={`Rename ${b.name}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        openRename(b)
                      }}
                      className="rounded p-1 text-neutral-500 opacity-0 hover:bg-neutral-700 hover:text-neutral-100 group-hover:opacity-100"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${b.name}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget(b)
                      }}
                      className="rounded p-1 text-neutral-500 opacity-0 hover:bg-neutral-700 hover:text-red-400 group-hover:opacity-100"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {boards.some((b) => b.id === boardId) ? (
        <div className="min-h-0 flex-1">
          <Whiteboard key={boardId} boardId={boardId} boardName={currentName} me={me} />
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-neutral-950">
          <p className="text-neutral-400">Нет доски. Создайте новую.</p>
          <Button onClick={createBoard}>+ Создать доску</Button>
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogTitle>Delete board?</DialogTitle>
          <DialogDescription>
            Board “{deleteTarget?.name}” will be permanently deleted for everyone. This action cannot be
            undone.
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) deleteBoard(deleteTarget.id)
                setDeleteTarget(null)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogTitle>Переименовать доску</DialogTitle>
          <DialogDescription>Введите новое название для доски «{renameTarget?.name}».</DialogDescription>
          <Input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyRename()
            }}
            placeholder="Название доски"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Отмена
            </Button>
            <Button onClick={applyRename}>Применить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
