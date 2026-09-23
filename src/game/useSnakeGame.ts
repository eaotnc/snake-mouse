import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import {
  BAIT_RADIUS,
  BOARD_H,
  BOARD_W,
  HEAD_HIT_RADIUS,
  LATCH_RADIUS,
  LEVEL_QUOTAS,
  PENALTY_MS,
  SEGMENT_PX,
  START_LENGTH,
} from './constants'
import {
  baitBob,
  buildMask,
  collides,
  drawScene,
  reachableCells,
  type Mask,
  type Ripple,
} from './draw'
import { MAZES, type Shape } from './mazes'
import { dist, trimPath, type Point } from './path'
import { playSound, unlockAudio } from './sound'

export type Phase = 'menu' | 'playing' | 'levelClear' | 'won' | 'gameover'

export type Hud = {
  phase: Phase
  level: number
  length: number
  baits: number
  quota: number
  clicks: number
  hits: number
}

type Sim = {
  phase: Phase
  level: number
  length: number
  baits: number
  latched: boolean
  latch: Point
  pointer: Point | null
  pointerInside: boolean
  path: Point[]
  bait: Point | null
  mask: Mask | null
  openCells: Point[]
  walls: Shape[]
  facing: Point
  penaltyReadyAt: number
  flashUntil: number
  shakeUntil: number
  ripples: Ripple[]
  dpr: number
  reduceMotion: boolean
  clicks: number
  hits: number
}

const initialHud: Hud = {
  phase: 'menu',
  level: 1,
  length: START_LENGTH,
  baits: 0,
  quota: LEVEL_QUOTAS[0],
  clicks: 0,
  hits: 0,
}

function createSim(): Sim {
  return {
    phase: 'menu',
    level: 0,
    length: START_LENGTH,
    baits: 0,
    latched: false,
    latch: { x: 0, y: 0 },
    pointer: null,
    pointerInside: false,
    path: [],
    bait: null,
    mask: null,
    openCells: [],
    walls: [],
    facing: { x: 1, y: 0 },
    penaltyReadyAt: 0,
    flashUntil: 0,
    shakeUntil: 0,
    ripples: [],
    dpr: 1,
    reduceMotion: false,
    clicks: 0,
    hits: 0,
  }
}

function publish(sim: Sim, setHud: (value: Hud | ((prev: Hud) => Hud)) => void) {
  const next: Hud = {
    phase: sim.phase,
    level: sim.level + 1,
    length: sim.length,
    baits: sim.baits,
    quota: LEVEL_QUOTAS[sim.level],
    clicks: sim.clicks,
    hits: sim.hits,
  }
  setHud((prev) =>
    prev.phase === next.phase &&
    prev.level === next.level &&
    prev.length === next.length &&
    prev.baits === next.baits &&
    prev.quota === next.quota &&
    prev.clicks === next.clicks &&
    prev.hits === next.hits
      ? prev
      : next,
  )
}

function seedPath(start: Point, lengthPx: number, mask: Mask): { path: Point[]; facing: Point } {
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [0.707, 0.707],
    [-0.707, 0.707],
    [0.707, -0.707],
    [-0.707, -0.707],
  ]
  const steps = Math.max(1, Math.ceil(lengthPx / 4))
  let best: Point[] = [{ ...start }]
  let bestFacing: Point = { x: 1, y: 0 }

  for (const [dx, dy] of dirs) {
    const pts: Point[] = []
    let clear = true
    for (let i = steps; i >= 0; i--) {
      const point = { x: start.x - dx * i * 4, y: start.y - dy * i * 4 }
      if (collides(mask, point, HEAD_HIT_RADIUS)) {
        clear = false
        break
      }
      pts.push(point)
    }
    if (clear && pts.length > 0) return { path: pts, facing: { x: dx, y: dy } }
    if (pts.length > best.length) {
      best = pts
      bestFacing = { x: dx, y: dy }
    }
  }

  const head = best[best.length - 1]
  if (!head || head.x !== start.x || head.y !== start.y) best.push({ ...start })
  return { path: best, facing: bestFacing }
}

function clearOfPath(cell: Point, path: Point[]) {
  for (let i = 0; i < path.length; i += 3) {
    if (dist(cell, path[i]) < 40) return false
  }
  return true
}

function pickBait(sim: Sim): Point | null {
  const head = sim.path[sim.path.length - 1] ?? sim.latch
  let pool = sim.openCells.filter((cell) => dist(cell, head) > 140 && clearOfPath(cell, sim.path))
  if (pool.length < 4) pool = sim.openCells.filter((cell) => dist(cell, head) > 80)
  if (pool.length === 0) pool = sim.openCells
  if (pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

function applyMaze(sim: Sim, levelIndex: number, keepLength: boolean) {
  const maze = MAZES[levelIndex]
  sim.level = levelIndex
  if (!keepLength) {
    sim.length = START_LENGTH
    sim.baits = 0
  }
  sim.walls = maze.walls
  sim.mask = buildMask(maze.walls)
  sim.openCells = reachableCells(sim.mask, maze.start)
  sim.latched = false
  sim.latch = { ...maze.start }
  const seeded = seedPath(maze.start, Math.max(SEGMENT_PX, sim.length * SEGMENT_PX), sim.mask)
  sim.path = seeded.path
  sim.facing = seeded.facing
  sim.bait = pickBait(sim)
  sim.ripples = []
  sim.penaltyReadyAt = 0
}

function penalize(
  sim: Sim,
  now: number,
  setHud: (value: Hud | ((prev: Hud) => Hud)) => void,
  cause: 'click' | 'wall',
) {
  if (sim.phase !== 'playing' || !sim.latched) return
  if (now < sim.penaltyReadyAt) return
  if (cause === 'click') sim.clicks += 1
  else sim.hits += 1
  sim.length -= 1
  sim.penaltyReadyAt = now + PENALTY_MS
  sim.flashUntil = now + 180
  sim.shakeUntil = now + 160
  trimPath(sim.path, Math.max(0, sim.length) * SEGMENT_PX)
  if (sim.length < 1) {
    sim.length = 0
    sim.phase = 'gameover'
    sim.latched = false
    playSound('gameover')
  } else {
    playSound(cause)
  }
  publish(sim, setHud)
}

function tryEat(sim: Sim, now: number, setHud: (value: Hud | ((prev: Hud) => Hud)) => void) {
  if (!sim.bait || sim.phase !== 'playing') return
  const head = sim.path[sim.path.length - 1]
  if (!head) return
  const baitPoint = { x: sim.bait.x, y: sim.bait.y + baitBob(now, sim.reduceMotion) }
  if (dist(head, baitPoint) > HEAD_HIT_RADIUS + BAIT_RADIUS) return

  sim.length += 1
  sim.baits += 1
  sim.ripples.push({ x: sim.bait.x, y: baitPoint.y, born: now })
  if (sim.baits >= LEVEL_QUOTAS[sim.level]) {
    sim.bait = null
    sim.latched = false
    const won = sim.level >= LEVEL_QUOTAS.length - 1
    sim.phase = won ? 'won' : 'levelClear'
    playSound(won ? 'win' : 'clear')
  } else {
    sim.bait = pickBait(sim)
    playSound('eat')
  }
  publish(sim, setHud)
}

function extendPath(
  sim: Sim,
  from: Point,
  to: Point,
  now: number,
  setHud: (value: Hud | ((prev: Hud) => Hud)) => void,
) {
  const distance = dist(from, to)
  const steps = Math.max(1, Math.ceil(distance / 4))
  let hit = false
  for (let i = 1; i <= steps; i++) {
    const point = {
      x: from.x + ((to.x - from.x) * i) / steps,
      y: from.y + ((to.y - from.y) * i) / steps,
    }
    if (sim.mask && collides(sim.mask, point, HEAD_HIT_RADIUS)) hit = true
    sim.path.push(point)
  }
  if (distance > 0.5) {
    sim.facing = { x: (to.x - from.x) / distance, y: (to.y - from.y) / distance }
  }
  trimPath(sim.path, sim.length * SEGMENT_PX)
  if (hit) penalize(sim, now, setHud, 'wall')
  if (sim.phase === 'playing') tryEat(sim, now, setHud)
}

export function useSnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simRef = useRef<Sim>(createSim())
  const [hud, setHud] = useState<Hud>(initialHud)

  const startGame = useCallback(() => {
    const sim = simRef.current
    sim.phase = 'playing'
    sim.clicks = 0
    sim.hits = 0
    applyMaze(sim, 0, false)
    publish(sim, setHud)
    void unlockAudio().then(() => playSound('start'))
  }, [])

  const nextLevel = useCallback(() => {
    const sim = simRef.current
    if (sim.phase !== 'levelClear') return
    sim.baits = 0
    applyMaze(sim, sim.level + 1, true)
    sim.phase = 'playing'
    publish(sim, setHud)
    void unlockAudio().then(() => playSound('start'))
  }, [])

  useEffect(() => {
    const sim = simRef.current
    sim.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    applyMaze(sim, 0, false)
    sim.phase = 'menu'
    publish(sim, setHud)

    const fit = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      sim.dpr = dpr
      canvas.width = Math.round(BOARD_W * dpr)
      canvas.height = Math.round(BOARD_H * dpr)
    }
    fit()
    window.addEventListener('resize', fit)

    let frame = 0
    const loop = (now: number) => {
      sim.ripples = sim.ripples.filter((ripple) => now - ripple.born < 480)

      if (sim.phase === 'playing' && sim.pointerInside && sim.pointer && sim.mask && sim.path.length > 0) {
        const head = sim.path[sim.path.length - 1]
        if (!sim.latched) {
          if (
            dist(sim.pointer, sim.latch) < LATCH_RADIUS &&
            !collides(sim.mask, sim.pointer, HEAD_HIT_RADIUS)
          ) {
            sim.latched = true
            playSound('latch')
            if (dist(head, sim.pointer) > 0.4) extendPath(sim, head, sim.pointer, now, setHud)
          }
        } else if (dist(head, sim.pointer) > 100) {
          sim.latched = false
          sim.latch = { x: head.x, y: head.y }
        } else if (dist(head, sim.pointer) > 0.4) {
          extendPath(sim, head, sim.pointer, now, setHud)
        } else {
          head.x = sim.pointer.x
          head.y = sim.pointer.y
          if (collides(sim.mask, head, HEAD_HIT_RADIUS)) penalize(sim, now, setHud, 'wall')
          if (sim.phase === 'playing') tryEat(sim, now, setHud)
        }
      }

      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (ctx && sim.mask) {
        const ghost =
          sim.pointerInside && sim.pointer && !(sim.phase === 'playing' && sim.latched)
            ? sim.pointer
            : null
        drawScene(
          ctx,
          {
            walls: sim.walls,
            path: sim.path,
            bait: sim.phase === 'menu' || sim.phase === 'playing' ? sim.bait : null,
            latch: sim.latch,
            showLatch: sim.phase === 'playing' && !sim.latched,
            ghost,
            facing: sim.facing,
            flash: now < sim.flashUntil,
            ripples: sim.ripples,
            now,
            shake: Math.max(0, sim.shakeUntil - now) / 160,
            reduceMotion: sim.reduceMotion,
          },
          sim.dpr,
        )
      }

      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', fit)
    }
  }, [])

  const pointFromEvent = (event: PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * BOARD_W,
      y: ((event.clientY - rect.top) / rect.height) * BOARD_H,
    }
  }

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const sim = simRef.current
    sim.pointerInside = true
    sim.pointer = pointFromEvent(event)
  }

  const onPointerLeave = () => {
    simRef.current.pointerInside = false
  }

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return
    void unlockAudio()
    penalize(simRef.current, performance.now(), setHud, 'click')
  }

  return { canvasRef, hud, startGame, nextLevel, onPointerMove, onPointerLeave, onPointerDown }
}
