const cache = new Map<string, string>()

export function setImageName(url: string, name: string) {
  if (url && name) cache.set(url, name)
}

export function getImageName(url: string): string | undefined {
  return cache.get(url)
}
