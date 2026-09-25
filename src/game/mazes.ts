import { BOARD_H, BOARD_W } from './constants'
import { buildMask, collides, reachableCells } from './draw'
import type { Point } from './path'

export type Shape =
  | { kind: 'blob'; x: number; y: number; w: number; h: number; r: number }
  | { kind: 'disc'; x: number; y: number; r: number }
  | {
      kind: 'arc'
      cx: number
      cy: number
      r: number
      start: number
      end: number
      thickness: number
    }
  | { kind: 'frame'; x: number; y: number; w: number; h: number; r: number; thickness: number }

export type Maze = {
  start: Point
  walls: Shape[]
}

function frame(): Shape {
  return {
    kind: 'frame',
    x: 8,
    y: 8,
    w: BOARD_W - 16,
    h: BOARD_H - 16,
    r: 18,
    thickness: 16,
  }
}

function startPoint(): Point {
  if (BOARD_H > BOARD_W) return { x: Math.round(BOARD_W / 2), y: 180 }
  return { x: 150, y: 300 }
}
const MAX_BARS = 14

export function generateMaze(level: number): Maze {
  const count = Math.min(MAX_BARS, 3 + level)
  for (let attempt = 0; attempt < 16; attempt++) {
    const rng = mulberry32((level + 1) * 997 + attempt * 131)
    const walls: Shape[] = [frame()]
    let placed = 0
    let tries = 0
    while (placed < count && tries < count * 40) {
      tries += 1
      const bar = randomBar(rng)
      if (coversStart(bar) || walls.some((wall) => wall.kind === 'blob' && overlaps(wall, bar))) continue
      walls.push(bar)
      placed += 1
    }
    const mask = buildMask(walls)
    const start = startPoint()
    if (!collides(mask, start, 16) && reachableCells(mask, start).length >= 48) {
      return { start, walls }
    }
  }
  return { start: startPoint(), walls: [frame()] }
}

function randomBar(rng: () => number): Extract<Shape, { kind: 'blob' }> {
  const vertical = rng() > 0.5
  const thick = 34
  const long = 120 + Math.floor(rng() * 150)
  const margin = 64
  if (vertical) {
    return {
      kind: 'blob',
      x: margin + rng() * (BOARD_W - margin * 2 - thick),
      y: margin + rng() * (BOARD_H - margin * 2 - long),
      w: thick,
      h: long,
      r: 8,
    }
  }
  return {
    kind: 'blob',
    x: margin + rng() * (BOARD_W - margin * 2 - long),
    y: margin + rng() * (BOARD_H - margin * 2 - thick),
    w: long,
    h: thick,
    r: 8,
  }
}

function coversStart(bar: Extract<Shape, { kind: 'blob' }>) {
  const start = startPoint()
  const pad = 70
  return (
    start.x > bar.x - pad &&
    start.x < bar.x + bar.w + pad &&
    start.y > bar.y - pad &&
    start.y < bar.y + bar.h + pad
  )
}

function overlaps(a: Extract<Shape, { kind: 'blob' }>, b: Extract<Shape, { kind: 'blob' }>) {
  const gap = 28
  return a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y
}

function mulberry32(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
