import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
