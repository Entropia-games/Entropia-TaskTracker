export type Point = { x: number; y: number }

export type Stroke = {
  id: string
  points: Point[]
  color: string
  size: number
  author: string
}

export type Card = {
  id: string
  x: number
  y: number
  w: number
  h: number
  text: string
  color: string
  author: string
}

export type ImageItem = {
  id: string
  x: number
  y: number
  w: number
  h: number
  src: string
  key: string
  author: string
}

export type BoardData = {
  strokes: Stroke[]
  cards: Card[]
  images: ImageItem[]
}

export type BoardPresence = {
  userId: string
  name: string
  color: string
  cursor: Point | null
}

export type Me = {
  id: string
  name: string
  color: string
}
