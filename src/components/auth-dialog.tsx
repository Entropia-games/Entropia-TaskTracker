"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/lib/auth-context"

export function AuthDialog({ open, onOpenChange, onSignedIn, gate }: { open: boolean; onOpenChange: (v: boolean) => void; onSignedIn?: () => void; gate?: boolean }) {
  const { signIn } = useAuth()
  const [nickname, setNickname] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setError(null)
    setSubmitting(true)
    const err = await signIn(nickname, password)
    setSubmitting(false)
    if (err) {
      setError(err)
    } else {
      onOpenChange(false)
      onSignedIn?.()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Sign in</DialogTitle>
        </DialogHeader>
        {gate && (
          <p className="px-2 -mt-1 text-xs text-muted-foreground">Вы не авторизованы, авторизуйтесь</p>
        )}
        <div className="flex flex-col gap-3 px-2">
          <Input
            placeholder="Nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          <Input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <span className="text-xs text-muted-foreground" />
          <Button size="sm" onClick={handleSubmit} disabled={!nickname || !password || submitting}>
            {submitting ? "..." : "Sign in"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
