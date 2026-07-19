import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const AVATAR_COLORS = [
  "bg-blue-600/20 text-blue-400",
  "bg-purple-600/20 text-purple-400",
  "bg-emerald-600/20 text-emerald-400",
  "bg-amber-600/20 text-amber-400",
  "bg-rose-600/20 text-rose-400",
  "bg-cyan-600/20 text-cyan-400",
  "bg-orange-600/20 text-orange-400",
  "bg-teal-600/20 text-teal-400",
  "bg-pink-600/20 text-pink-400",
  "bg-indigo-600/20 text-indigo-400",
  "bg-lime-600/20 text-lime-400",
  "bg-violet-600/20 text-violet-400",
]

export function userAvatarColor(name: string | null | undefined): string {
  const s = name ?? ""
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

const URL_REGEX = /(https?:\/\/[^\s<]+)/g

export function linkify(text: string) {
  const parts = text.split(URL_REGEX)
  return parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0
      return { type: "link" as const, url: part, key: i }
    }
    return { type: "text" as const, text: part, key: i }
  })
}
