import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import {
  BAIT_RADIUS,
  BOARD_H,
  BOARD_W,
  BAIT_TTL_MS,
  BITE_TIME_MS,
  boardIsPortrait,
  HEAD_HIT_RADIUS,
  LATCH_RADIUS,
  LEVEL_TIME_MS,
  MAX_LENGTH,
  WALL_SCORE_PENALTY,
  PENALTY_MS,
  quotaFor,
  SEGMENT_PX,
  setPortraitBoard,
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
import { generateMaze, type Shape } from './mazes'
import { dist, trimPath, type Point } from './path'
import { playSound, setMusicBpm, startMusic, stopMusic, unlockAudio } from './sound'

export type Phase = 'menu' | 'playing' | 'levelClear' | 'gameover'

export type Hud = {
  phase: Phase
  level: number
  length: number
  baits: number
  quota: number
  clicks: number
  hits: number
  score: number
  timeLeft: number
  streak: number
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
  baitUntil: number
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
  score: number
  timeLeftMs: number
  clockAt: number
  shownTime: number
  streak: number
  streakPopAt: number
}

const initialHud: Hud = {
  phase: 'menu',
  level: 1,
  length: START_LENGTH,
  baits: 0,
  quota: quotaFor(0),
  clicks: 0,
  hits: 0,
  score: 0,
  timeLeft: LEVEL_TIME_MS / 1000,
  streak: 0,
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
    baitUntil: 0,
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
    score: 0,
    timeLeftMs: LEVEL_TIME_MS,
    clockAt: 0,
    shownTime: Math.ceil(LEVEL_TIME_MS / 100) / 10,
    streak: 0,
    streakPopAt: 0,
  }
}

function publish(sim: Sim, setHud: (value: Hud | ((prev: Hud) => Hud)) => void) {
  const next: Hud = {
    phase: sim.phase,
    level: sim.level + 1,
    length: sim.length,
    baits: sim.baits,
    quota: quotaFor(sim.level),
    clicks: sim.clicks,
    hits: sim.hits,
    score: sim.score,
    timeLeft: Math.ceil(sim.timeLeftMs / 100) / 10,
    streak: sim.streak,
  }
  setHud((prev) =>
    prev.phase === next.phase &&
    prev.level === next.level &&
    prev.length === next.length &&
    prev.baits === next.baits &&
    prev.quota === next.quota &&
    prev.clicks === next.clicks &&
    prev.hits === next.hits &&
    prev.score === next.score &&
    prev.timeLeft === next.timeLeft &&
    prev.streak === next.streak
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

function pickBait(sim: Sim, avoid?: Point | null): Point | null {
  const head = sim.path[sim.path.length - 1] ?? sim.latch
  const away = (cell: Point) => !avoid || dist(cell, avoid) > 80
  let pool = sim.openCells.filter((cell) => dist(cell, head) > 140 && clearOfPath(cell, sim.path) && away(cell))
  if (pool.length < 4) pool = sim.openCells.filter((cell) => dist(cell, head) > 80 && away(cell))
  if (pool.length === 0) pool = sim.openCells.filter(away)
  if (pool.length === 0) pool = sim.openCells
  if (pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

function placeBait(sim: Sim, now: number, avoid?: Point | null) {
  sim.bait = pickBait(sim, avoid)
  sim.baitUntil = now + BAIT_TTL_MS
}

function applyMaze(sim: Sim, levelIndex: number) {
  const maze = generateMaze(levelIndex)
  sim.level = levelIndex
  sim.length = START_LENGTH
  sim.baits = 0
  sim.walls = maze.walls
  sim.mask = buildMask(maze.walls)
  sim.openCells = reachableCells(sim.mask, maze.start)
  sim.latched = false
  sim.latch = { ...maze.start }
  const seeded = seedPath(maze.start, Math.max(SEGMENT_PX, sim.length * SEGMENT_PX), sim.mask)
  sim.path = seeded.path
  sim.facing = seeded.facing
  placeBait(sim, performance.now())
  sim.timeLeftMs = LEVEL_TIME_MS
  sim.clockAt = 0
  sim.shownTime = Math.ceil(LEVEL_TIME_MS / 100) / 10
  setMusicBpm(100)
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
  else {
    sim.hits += 1
    sim.score = Math.max(0, sim.score - WALL_SCORE_PENALTY)
  }
  sim.length -= 1
  sim.penaltyReadyAt = now + PENALTY_MS
  sim.flashUntil = now + 180
  sim.shakeUntil = now + 160
  trimPath(sim.path, Math.max(0, sim.length) * SEGMENT_PX)
  if (sim.length < 1) {
    sim.length = 0
    sim.phase = 'gameover'
    sim.latched = false
    stopMusic()
    playSound('gameover')
  } else {
    playSound(cause)
  }
  publish(sim, setHud)
}

function tickClock(sim: Sim, now: number, setHud: (value: Hud | ((prev: Hud) => Hud)) => void) {
  if (sim.phase !== 'playing') return
  if (sim.clockAt > 0) sim.timeLeftMs -= now - sim.clockAt
  sim.clockAt = now
  const seconds = Math.max(0, sim.timeLeftMs / 1000)
  setMusicBpm(seconds <= 4 ? 100 + ((4 - seconds) / 4) * 60 : 100)
  if (sim.timeLeftMs <= 0) {
    sim.timeLeftMs = 0
    sim.phase = 'gameover'
    sim.latched = false
    sim.bait = null
    setMusicBpm(100)
    stopMusic()
    playSound('gameover')
    publish(sim, setHud)
    return
  }
  const shown = Math.ceil(sim.timeLeftMs / 100) / 10
  if (shown !== sim.shownTime) {
    sim.shownTime = shown
    publish(sim, setHud)
  }
}

function expireBait(sim: Sim, now: number, setHud: (value: Hud | ((prev: Hud) => Hud)) => void) {
  if (sim.phase !== 'playing' || !sim.bait || now < sim.baitUntil) return
  const previous = sim.bait
  sim.streak = 0
  placeBait(sim, now, previous)
  sim.length -= 1
  sim.flashUntil = now + 180
  sim.shakeUntil = now + 160
  trimPath(sim.path, Math.max(0, sim.length) * SEGMENT_PX)
  if (sim.length < 1) {
    sim.length = 0
    sim.bait = null
    sim.phase = 'gameover'
    sim.latched = false
    stopMusic()
    playSound('gameover')
  } else {
    playSound('wall')
  }
  publish(sim, setHud)
}

function streakMultiplier(streak: number) {
  if (streak >= 12) return 5
  if (streak >= 8) return 3
  if (streak >= 3) return 2
  return 1
}

function tryEat(sim: Sim, now: number, setHud: (value: Hud | ((prev: Hud) => Hud)) => void) {
  if (!sim.bait || sim.phase !== 'playing') return
  const head = sim.path[sim.path.length - 1]
  if (!head) return
  const baitPoint = { x: sim.bait.x, y: sim.bait.y + baitBob(now, sim.reduceMotion) }
  if (dist(head, baitPoint) > HEAD_HIT_RADIUS + BAIT_RADIUS) return

  const elapsed = now - (sim.baitUntil - BAIT_TTL_MS)
  const fast = elapsed <= 1000
  sim.streak = fast ? sim.streak + 1 : 0
  const multiplier = fast ? streakMultiplier(sim.streak) : 1
  sim.score += (fast ? 2 : 1) * multiplier
  if (sim.streak >= 3) sim.streakPopAt = now
  if (sim.length < MAX_LENGTH) sim.length += 1
  sim.timeLeftMs += BITE_TIME_MS
  sim.baits += 1
  sim.ripples.push({ x: sim.bait.x, y: baitPoint.y, born: now })
  if (sim.baits >= quotaFor(sim.level)) {
    sim.bait = null
    sim.latched = false
    sim.phase = 'levelClear'
    playSound('clear')
  } else {
    placeBait(sim, now, sim.bait)
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
    sim.score = 0
    sim.streak = 0
    applyMaze(sim, 0)
    publish(sim, setHud)
    void unlockAudio().then(() => {
      playSound('start')
      startMusic()
    })
  }, [])

  const nextLevel = useCallback(() => {
    const sim = simRef.current
    if (sim.phase !== 'levelClear') return
    applyMaze(sim, sim.level + 1)
    sim.phase = 'playing'
    publish(sim, setHud)
    void unlockAudio().then(() => {
      playSound('start')
      startMusic()
    })
  }, [])

  useEffect(() => {
    const sim = simRef.current
    sim.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    applyMaze(sim, 0)
    sim.phase = 'menu'
    publish(sim, setHud)

    const fit = () => {
      const canvas = canvasRef.current
      const stage = canvas?.parentElement
      if (!canvas || !stage) return
      const portrait = window.matchMedia('(max-width: 800px)').matches
      if (portrait !== boardIsPortrait()) {
        setPortraitBoard(portrait)
        const phase = sim.phase
        const clicks = sim.clicks
        const hits = sim.hits
        const length = sim.length
        const baits = sim.baits
        const score = sim.score
        const timeLeftMs = sim.timeLeftMs
        const streak = sim.streak
        applyMaze(sim, sim.level)
        sim.phase = phase
        sim.clicks = clicks
        sim.hits = hits
        sim.score = score
        sim.streak = streak
        if (phase === 'playing' || phase === 'levelClear') {
          sim.length = length
          sim.baits = baits
          sim.timeLeftMs = timeLeftMs
          sim.shownTime = Math.ceil(timeLeftMs / 100) / 10
          trimPath(sim.path, Math.max(SEGMENT_PX, length * SEGMENT_PX))
        }
        publish(sim, setHud)
      }
      const bounds = stage.getBoundingClientRect()
      const scale = Math.min(bounds.width / BOARD_W, bounds.height / BOARD_H)
      const cssW = Math.max(1, Math.floor(BOARD_W * scale))
      const cssH = Math.max(1, Math.round((cssW * BOARD_H) / BOARD_W))
      const pixels = Math.min(window.devicePixelRatio || 1, 2)
      sim.dpr = (cssW * pixels) / BOARD_W
      canvas.width = Math.round(cssW * pixels)
      canvas.height = Math.round(cssH * pixels)
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
    }
    fit()
    const observer = new ResizeObserver(fit)
    const stage = canvasRef.current?.parentElement
    if (stage) observer.observe(stage)
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

      if (sim.phase === 'playing') {
        expireBait(sim, now, setHud)
        tickClock(sim, now, setHud)
      } else {
        sim.clockAt = 0
        setMusicBpm(100)
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
            baitLeft:
              sim.phase === 'playing' && sim.bait ? Math.max(0, (sim.baitUntil - now) / 1000) : null,
            streak: sim.streak,
            streakPopAt: sim.streakPopAt,
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
      observer.disconnect()
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
