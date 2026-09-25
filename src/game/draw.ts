import {
  BAIT_RADIUS,
  BOARD_H,
  BOARD_W,
  HEAD_RADIUS,
  LATCH_RADIUS,
} from './constants'
import type { Shape } from './mazes'
import { dist, lerp, resampleFromHead, smoothOpen, type Point } from './path'

export type Mask = {
  data: Uint8ClampedArray
  width: number
  height: number
}

export type Ripple = { x: number; y: number; born: number }

export type Scene = {
  walls: Shape[]
  path: Point[]
  bait: Point | null
  baitLeft: number | null
  latch: Point
  showLatch: boolean
  ghost: Point | null
  facing: Point
  flash: boolean
  ripples: Ripple[]
  now: number
  shake: number
  reduceMotion: boolean
  streak: number
  streakPopAt: number
  immortal: boolean
  immortalPopAt: number
}

export function baitBob(now: number, reduceMotion: boolean): number {
  return reduceMotion ? 0 : Math.sin(now / 280) * 3
}

export function buildMask(walls: Shape[]): Mask {
  const canvas = document.createElement('canvas')
  canvas.width = BOARD_W
  canvas.height = BOARD_H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Could not create the maze mask')
  ctx.clearRect(0, 0, BOARD_W, BOARD_H)
  for (const wall of walls) paintShape(ctx, wall, true)
  const image = ctx.getImageData(0, 0, BOARD_W, BOARD_H)
  return { data: image.data, width: BOARD_W, height: BOARD_H }
}

export function collides(mask: Mask, point: Point, radius: number): boolean {
  if (solid(mask, point.x, point.y)) return true
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    if (solid(mask, point.x + Math.cos(angle) * radius, point.y + Math.sin(angle) * radius)) {
      return true
    }
  }
  return false
}

const CELL = 28

export function openCells(mask: Mask): Point[] {
  const cells: Point[] = []
  const margin = 64
  for (let y = margin; y <= BOARD_H - margin; y += CELL) {
    for (let x = margin; x <= BOARD_W - margin; x += CELL) {
      if (!collides(mask, { x, y }, BAIT_RADIUS + 4)) cells.push({ x, y })
    }
  }
  return cells
}

/** Open cells that can be reached from `start` without crossing a wall. */
export function reachableCells(mask: Mask, start: Point): Point[] {
  const open = openCells(mask)
  if (open.length === 0) return []

  const key = (point: Point) => `${point.x},${point.y}`
  const byKey = new Map(open.map((cell) => [key(cell), cell]))
  let origin: Point | null = null
  let best = Infinity
  for (const cell of open) {
    const distance = dist(cell, start)
    if (distance < best && segmentClear(mask, start, cell)) {
      best = distance
      origin = cell
    }
  }
  if (!origin) return open

  const seen = new Set<string>([key(origin)])
  const queue = [origin]
  const reach: Point[] = []
  while (queue.length > 0) {
    const current = queue.shift()!
    reach.push(current)
    for (const [ox, oy] of [
      [CELL, 0],
      [-CELL, 0],
      [0, CELL],
      [0, -CELL],
    ] as const) {
      const next = byKey.get(`${current.x + ox},${current.y + oy}`)
      if (!next || seen.has(key(next))) continue
      if (!segmentClear(mask, current, next)) continue
      seen.add(key(next))
      queue.push(next)
    }
  }
  return reach
}

function segmentClear(mask: Mask, from: Point, to: Point): boolean {
  const steps = Math.max(1, Math.ceil(dist(from, to) / 8))
  for (let i = 0; i <= steps; i++) {
    const point = lerp(from, to, i / steps)
    if (collides(mask, point, BAIT_RADIUS)) return false
  }
  return true
}

export function drawScene(ctx: CanvasRenderingContext2D, scene: Scene, dpr: number) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, BOARD_W, BOARD_H)
  drawBackground(ctx)

  ctx.save()
  if (scene.shake > 0) {
    ctx.translate(
      Math.sin(scene.now * 0.35) * 4 * scene.shake,
      Math.cos(scene.now * 0.48) * 3 * scene.shake,
    )
  }

  for (const wall of scene.walls) paintShape(ctx, wall, false)

  if (scene.showLatch) drawLatch(ctx, scene.latch, scene.now)
  if (scene.bait) drawBait(ctx, scene.bait, scene.now, scene.reduceMotion, scene.baitLeft)
  for (const ripple of scene.ripples) drawRipple(ctx, ripple, scene.now)

  drawSnake(
    ctx,
    scene.path,
    scene.facing,
    scene.now,
    scene.flash,
    scene.reduceMotion,
    scene.streak,
  )
  if (scene.ghost) drawHead(ctx, scene.ghost, scene.facing, 8, false, 0)

  if (scene.flash) {
    ctx.fillStyle = 'rgba(255, 70, 60, 0.16)'
    ctx.fillRect(0, 0, BOARD_W, BOARD_H)
  }
  ctx.restore()
  drawStreak(ctx, scene.streak, scene.now, scene.streakPopAt, scene.immortal)
  drawImmortal(ctx, scene.immortal, scene.now, scene.immortalPopAt)
}

function solid(mask: Mask, x: number, y: number): boolean {
  const ix = Math.round(x)
  const iy = Math.round(y)
  if (ix < 0 || iy < 0 || ix >= mask.width || iy >= mask.height) return true
  return mask.data[(iy * mask.width + ix) * 4 + 3] > 24
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const sky = ctx.createLinearGradient(0, 0, 0, BOARD_H)
  sky.addColorStop(0, '#16382e')
  sky.addColorStop(1, '#091612')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, BOARD_W, BOARD_H)

  ctx.fillStyle = 'rgba(214, 255, 74, 0.05)'
  ctx.beginPath()
  ctx.arc(180, 80, 160, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(820, 520, 200, 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.roundRect(12, 12, BOARD_W - 24, BOARD_H - 24, 8)
  ctx.fillStyle = '#10241c'
  ctx.fill()

  ctx.fillStyle = 'rgba(231, 242, 234, 0.045)'
  for (let y = 56; y < BOARD_H - 48; y += 22) {
    for (let x = 56; x < BOARD_W - 48; x += 22) {
      ctx.fillRect(x, y, 1.4, 1.4)
    }
  }
}

function paintShape(ctx: CanvasRenderingContext2D, shape: Shape, mask: boolean) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  traceObstacle(ctx, shape)
  const band = shape.kind === 'arc' || shape.kind === 'frame'

  if (mask) {
    ctx.fillStyle = '#fff'
    if (band) ctx.fill('evenodd')
    else ctx.fill()
    return
  }

  ctx.save()
  ctx.translate(1.5, 7)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.34)'
  if (band) ctx.fill('evenodd')
  else ctx.fill()
  ctx.restore()

  ctx.fillStyle = '#6e675c'
  if (band) ctx.fill('evenodd')
  else ctx.fill()

  ctx.save()
  if (band) ctx.clip('evenodd')
  else ctx.clip()
  shadeStone(ctx, boundsOf(shape))
  grain(ctx, boundsOf(shape), shape)
  cracks(ctx, boundsOf(shape), shape)
  if (shape.kind === 'blob') mortar(ctx, shape)
  if (shape.kind === 'frame') frameCourses(ctx)
  ctx.restore()

  traceObstacle(ctx, shape)
  ctx.strokeStyle = 'rgba(236, 230, 218, 0.28)'
  ctx.lineWidth = 1.25
  if (!band) ctx.stroke()
}

function traceObstacle(ctx: CanvasRenderingContext2D, shape: Shape) {
  if (shape.kind === 'disc') traceDisc(ctx, shape.x, shape.y, shape.r)
  else if (shape.kind === 'blob') traceBlob(ctx, shape)
  else if (shape.kind === 'arc') traceArc(ctx, shape)
  else traceFrame(ctx, shape)
}

function traceDisc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const phase = seedOf(x, y) * Math.PI * 2
  ctx.beginPath()
  const steps = 42
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2
    const scale = 0.9 + 0.055 * Math.sin(angle * 3 + phase) + 0.03 * Math.sin(angle * 7 + phase * 2)
    const px = x + Math.cos(angle) * r * scale
    const py = y + Math.sin(angle) * r * scale
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  for (let k = 0; k < 3; k++) {
    const angle = phase + k * 2.2
    const pebble = r * (0.2 + k * 0.045)
    const px = x + Math.cos(angle) * r * 0.56
    const py = y + Math.sin(angle) * r * 0.56
    ctx.moveTo(px + pebble, py)
    ctx.arc(px, py, pebble, 0, Math.PI * 2)
  }
}

function traceBlob(ctx: CanvasRenderingContext2D, shape: Extract<Shape, { kind: 'blob' }>) {
  const rad = Math.min(shape.r, shape.w / 2, shape.h / 2)
  const x0 = shape.x
  const y0 = shape.y
  const x1 = shape.x + shape.w
  const y1 = shape.y + shape.h
  const phase = seedOf(shape.x, shape.y) * Math.PI * 2
  const points: { x: number; y: number; nx: number; ny: number }[] = []

  const addLine = (ax: number, ay: number, bx: number, by: number, nx: number, ny: number, steps: number) => {
    for (let i = 0; i < steps; i++) {
      const t = i / steps
      points.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, nx, ny })
    }
  }
  const addArc = (cx: number, cy: number, a0: number, a1: number) => {
    const steps = 6
    for (let i = 0; i < steps; i++) {
      const angle = a0 + ((a1 - a0) * i) / steps
      points.push({
        x: cx + Math.cos(angle) * rad,
        y: cy + Math.sin(angle) * rad,
        nx: Math.cos(angle),
        ny: Math.sin(angle),
      })
    }
  }

  const edge = Math.max(2, Math.round(Math.max(shape.w, shape.h) / 42))
  addLine(x0 + rad, y0, x1 - rad, y0, 0, -1, edge)
  addArc(x1 - rad, y0 + rad, -Math.PI / 2, 0)
  addLine(x1, y0 + rad, x1, y1 - rad, 1, 0, edge)
  addArc(x1 - rad, y1 - rad, 0, Math.PI / 2)
  addLine(x1 - rad, y1, x0 + rad, y1, 0, 1, edge)
  addArc(x0 + rad, y1 - rad, Math.PI / 2, Math.PI)
  addLine(x0, y1 - rad, x0, y0 + rad, -1, 0, edge)
  addArc(x0 + rad, y0 + rad, Math.PI, Math.PI * 1.5)

  ctx.beginPath()
  points.forEach((point, i) => {
    const amp = 2.2 * Math.sin(i * 0.7 + phase) + 1.1 * Math.sin(i * 1.6 + phase * 2)
    const px = point.x + point.nx * amp
    const py = point.y + point.ny * amp
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  })
  ctx.closePath()
}

function traceArc(ctx: CanvasRenderingContext2D, shape: Extract<Shape, { kind: 'arc' }>) {
  const outer = shape.r + shape.thickness / 2
  const inner = Math.max(1, shape.r - shape.thickness / 2)
  ctx.beginPath()
  ctx.arc(shape.cx, shape.cy, outer, shape.start, shape.end)
  ctx.arc(shape.cx, shape.cy, inner, shape.end, shape.start, true)
  ctx.closePath()
  const cap = shape.thickness / 2
  ctx.arc(
    shape.cx + Math.cos(shape.start) * shape.r,
    shape.cy + Math.sin(shape.start) * shape.r,
    cap,
    0,
    Math.PI * 2,
  )
  ctx.arc(
    shape.cx + Math.cos(shape.end) * shape.r,
    shape.cy + Math.sin(shape.end) * shape.r,
    cap,
    0,
    Math.PI * 2,
  )
}

function traceFrame(ctx: CanvasRenderingContext2D, shape: Extract<Shape, { kind: 'frame' }>) {
  const t = shape.thickness
  ctx.beginPath()
  ctx.roundRect(shape.x - t / 2, shape.y - t / 2, shape.w + t, shape.h + t, shape.r + t / 2)
  ctx.roundRect(
    shape.x + t / 2,
    shape.y + t / 2,
    Math.max(1, shape.w - t),
    Math.max(1, shape.h - t),
    Math.max(0, shape.r - t / 2),
  )
}

function shadeStone(ctx: CanvasRenderingContext2D, box: Box) {
  const light = ctx.createLinearGradient(box.x, box.y, box.x, box.y + box.h)
  light.addColorStop(0, 'rgba(244, 238, 226, 0.42)')
  light.addColorStop(0.38, 'rgba(244, 238, 226, 0)')
  light.addColorStop(1, 'rgba(22, 18, 14, 0.38)')
  ctx.fillStyle = light
  ctx.fillRect(box.x - 8, box.y - 8, box.w + 16, box.h + 16)
}

function grain(ctx: CanvasRenderingContext2D, box: Box, shape: Shape) {
  const count = shape.kind === 'frame' ? 220 : shape.kind === 'arc' ? 80 : 46
  for (let i = 0; i < count; i++) {
    const px = box.x - 6 + rand(shape, i) * (box.w + 12)
    const py = box.y - 6 + rand(shape, i + 40) * (box.h + 12)
    ctx.fillStyle = rand(shape, i + 80) > 0.55 ? 'rgba(236, 230, 218, 0.22)' : 'rgba(28, 24, 20, 0.28)'
    ctx.beginPath()
    ctx.arc(px, py, 0.5 + rand(shape, i + 120) * 1.7, 0, Math.PI * 2)
    ctx.fill()
  }
  if (shape.kind !== 'frame' && seedOf(box.x, box.y) > 0.35) {
    ctx.fillStyle = 'rgba(58, 86, 62, 0.3)'
    ctx.beginPath()
    ctx.ellipse(box.x + box.w * 0.55, box.y + box.h * 0.76, box.w * 0.18, Math.max(3, box.h * 0.07), 0.2, 0, Math.PI * 2)
    ctx.fill()
  }
}

function cracks(ctx: CanvasRenderingContext2D, box: Box, shape: Shape) {
  ctx.strokeStyle = 'rgba(32, 26, 22, 0.4)'
  ctx.lineWidth = 1
  const cracksToDraw = shape.kind === 'disc' ? 2 : 1
  for (let c = 0; c < cracksToDraw; c++) {
    let x = box.x + rand(shape, 200 + c) * box.w
    let y = box.y + rand(shape, 230 + c) * box.h
    ctx.beginPath()
    ctx.moveTo(x, y)
    for (let k = 0; k < 4; k++) {
      x += (rand(shape, 260 + c * 10 + k) - 0.5) * box.w * 0.28
      y += (rand(shape, 300 + c * 10 + k) - 0.4) * box.h * 0.28
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
}

function mortar(ctx: CanvasRenderingContext2D, shape: Extract<Shape, { kind: 'blob' }>) {
  if (Math.max(shape.w, shape.h) < Math.min(shape.w, shape.h) * 2.2) return
  ctx.strokeStyle = 'rgba(32, 26, 22, 0.42)'
  ctx.lineWidth = 1.6
  const horizontal = shape.w >= shape.h
  const span = horizontal ? shape.w : shape.h
  for (let i = 34; i < span - 16; i += 40 + rand(shape, i) * 18) {
    const jog = (rand(shape, i + 7) - 0.5) * 8
    ctx.beginPath()
    if (horizontal) {
      ctx.moveTo(shape.x + i, shape.y - 6)
      ctx.lineTo(shape.x + i + jog, shape.y + shape.h + 6)
    } else {
      ctx.moveTo(shape.x - 6, shape.y + i)
      ctx.lineTo(shape.x + shape.w + 6, shape.y + i + jog)
    }
    ctx.stroke()
  }
}

function frameCourses(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = 'rgba(32, 26, 22, 0.38)'
  ctx.lineWidth = 1.5
  const edge = 8
  for (let x = 24; x < BOARD_W - 8; x += 86) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + 3, edge)
    ctx.moveTo(x + 28, BOARD_H)
    ctx.lineTo(x + 25, BOARD_H - edge)
    ctx.stroke()
  }
  for (let y = 28; y < BOARD_H - 8; y += 92) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(edge, y + 2)
    ctx.moveTo(BOARD_W, y + 36)
    ctx.lineTo(BOARD_W - edge, y + 34)
    ctx.stroke()
  }
}

type Box = { x: number; y: number; w: number; h: number }

function boundsOf(shape: Shape): Box {
  if (shape.kind === 'disc') return { x: shape.x - shape.r, y: shape.y - shape.r, w: shape.r * 2, h: shape.r * 2 }
  if (shape.kind === 'blob') return { x: shape.x, y: shape.y, w: shape.w, h: shape.h }
  if (shape.kind === 'arc') {
    const reach = shape.r + shape.thickness
    return { x: shape.cx - reach, y: shape.cy - reach, w: reach * 2, h: reach * 2 }
  }
  return { x: 0, y: 0, w: BOARD_W, h: BOARD_H }
}

function seedOf(x: number, y: number) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return n - Math.floor(n)
}

function rand(shape: Shape, index: number) {
  const box = boundsOf(shape)
  const n = Math.sin(seedOf(box.x, box.y) * 900 + index * 17.13) * 43758.5453
  return n - Math.floor(n)
}

function drawLatch(ctx: CanvasRenderingContext2D, latch: Point, now: number) {
  const pulse = LATCH_RADIUS + Math.sin(now / 200) * 3
  ctx.beginPath()
  ctx.arc(latch.x, latch.y, pulse, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(214, 255, 74, 0.9)'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(latch.x, latch.y, 5, 0, Math.PI * 2)
  ctx.fillStyle = '#d6ff4a'
  ctx.fill()

  ctx.font = '600 14px Outfit, "Avenir Next", sans-serif'
  ctx.fillStyle = 'rgba(231, 242, 234, 0.88)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const below = latch.y < BOARD_H - 90
  ctx.fillText('hover here', latch.x, latch.y + (below ? 46 : -42))
}

function drawBait(
  ctx: CanvasRenderingContext2D,
  bait: Point,
  now: number,
  reduceMotion: boolean,
  baitLeft: number | null,
) {
  const y = bait.y + baitBob(now, reduceMotion)
  const pulse = BAIT_RADIUS + (reduceMotion ? 0 : Math.sin(now / 220) * 1.4)
  const glow = ctx.createRadialGradient(bait.x, y, 2, bait.x, y, pulse * 2.6)
  glow.addColorStop(0, 'rgba(255, 191, 60, 0.5)')
  glow.addColorStop(1, 'rgba(255, 191, 60, 0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(bait.x, y, pulse * 2.6, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#ffbf3c'
  ctx.beginPath()
  ctx.arc(bait.x, y, pulse, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff1c2'
  ctx.beginPath()
  ctx.arc(bait.x - pulse * 0.28, y - pulse * 0.32, pulse * 0.28, 0, Math.PI * 2)
  ctx.fill()

  if (baitLeft == null) return
  const fraction = Math.max(0, Math.min(1, baitLeft / 2))
  ctx.beginPath()
  ctx.arc(bait.x, y, pulse + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fraction)
  ctx.strokeStyle = fraction < 0.35 ? '#ff8d7a' : '#fff1c2'
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.font = '700 13px Outfit, "Avenir Next", sans-serif'
  ctx.fillStyle = '#fff1c2'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(Math.ceil(baitLeft)), bait.x, y - pulse - 16)
}

function drawRipple(ctx: CanvasRenderingContext2D, ripple: Ripple, now: number) {
  const t = (now - ripple.born) / 450
  if (t < 0 || t > 1) return
  ctx.beginPath()
  ctx.arc(ripple.x, ripple.y, 8 + t * 30, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(255, 191, 60, ${1 - t})`
  ctx.lineWidth = 2
  ctx.stroke()
}

function drawSnake(
  ctx: CanvasRenderingContext2D,
  path: Point[],
  facing: Point,
  now: number,
  flash: boolean,
  reduceMotion: boolean,
  streak: number,
) {
  const samples = smoothOpen(resampleFromHead(path, 7))
  if (samples.length === 0) return
  const dancing = streak >= 3
  const waved = reduceMotion ? samples : wave(samples, now, dancing ? streak : 0)

  if (dancing) drawDanceFloor(ctx, waved, now, streak)

  ctx.save()
  if (dancing) {
    ctx.shadowColor = streak >= 12 ? '#ffe27a' : '#d6ff4a'
    ctx.shadowBlur = streak >= 12 ? 22 : 14
  }
  for (let i = waved.length - 1; i >= 0; i--) {
    const t = i / Math.max(1, waved.length - 1)
    const radius = Math.max(3.2, HEAD_RADIUS * (1 - t * 0.7))
    ctx.fillStyle = bodyColor(t, flash, dancing)
    ctx.beginPath()
    ctx.arc(waved[i].x, waved[i].y, radius, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  drawHead(ctx, waved[0], facing, HEAD_RADIUS, flash, streak)
}

function drawDanceFloor(ctx: CanvasRenderingContext2D, samples: Point[], now: number, streak: number) {
  const glow = streak >= 12 ? '255, 210, 74' : '214, 255, 74'
  for (const point of samples) {
    const pulse = 16 + Math.sin(now / 120 + point.x * 0.02) * 4
    ctx.fillStyle = `rgba(${glow}, 0.16)`
    ctx.beginPath()
    ctx.ellipse(point.x, point.y + 10, pulse, pulse * 0.35, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

function wave(samples: Point[], now: number, streak: number): Point[] {
  const dancing = streak >= 3
  const ampScale = streak >= 12 ? 7.5 : streak >= 8 ? 6 : dancing ? 4.8 : 2.6
  const speed = dancing ? 80 : 140
  return samples.map((point, i) => {
    const t = i / Math.max(1, samples.length - 1)
    const envelope = Math.sin(Math.PI * t)
    if (envelope === 0 && !dancing) return point
    const prev = samples[Math.max(0, i - 1)]
    const next = samples[Math.min(samples.length - 1, i + 1)]
    let tx = next.x - prev.x
    let ty = next.y - prev.y
    const mag = Math.hypot(tx, ty) || 1
    tx /= mag
    ty /= mag
    const amp = Math.sin(now / speed - i * 0.65) * ampScale * (envelope || 0.35)
    const hop = dancing ? Math.sin(now / 90 - i * 0.4) * 3.2 : 0
    return { x: point.x + -ty * amp, y: point.y + tx * amp - hop }
  })
}

function drawHead(
  ctx: CanvasRenderingContext2D,
  head: Point,
  facing: Point,
  radius: number,
  flash: boolean,
  streak: number,
) {
  if (streak >= 3) {
    ctx.save()
    ctx.shadowColor = streak >= 12 ? '#ffe27a' : '#d6ff4a'
    ctx.shadowBlur = 16
  }
  ctx.fillStyle = flash ? '#ffb0a8' : streak >= 3 ? '#f6ff9a' : '#f3ffd4'
  ctx.beginPath()
  ctx.arc(head.x, head.y, radius, 0, Math.PI * 2)
  ctx.fill()

  const mag = Math.hypot(facing.x, facing.y) || 1
  const fx = facing.x / mag
  const fy = facing.y / mag
  const sx = -fy
  const sy = fx
  const spread = radius * 0.42
  const forward = radius * 0.22
  for (const side of [-1, 1]) {
    const ex = head.x + fx * forward + sx * spread * side
    const ey = head.y + fy * forward + sy * spread * side
    ctx.fillStyle = '#f7fff8'
    ctx.beginPath()
    ctx.arc(ex, ey, radius * 0.24, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#14241c'
    ctx.beginPath()
    ctx.arc(ex + fx * radius * 0.08, ey + fy * radius * 0.08, radius * 0.12, 0, Math.PI * 2)
    ctx.fill()
  }
  if (streak >= 3) ctx.restore()
}

function drawStreak(
  ctx: CanvasRenderingContext2D,
  streak: number,
  now: number,
  popAt: number,
  immortal: boolean,
) {
  if (streak < 3) return
  const age = now - popAt
  if (age > 500) return
  const pop = age < 120 ? 1.08 : 1
  const multiplier = immortal ? 10 : Math.min(10, streak)
  ctx.save()
  ctx.translate(BOARD_W / 2, BOARD_H / 2 + (immortal ? 28 : 0))
  ctx.scale(pop, pop)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(214, 255, 74, 0.82)'
  ctx.font = '800 28px Syne, Outfit, sans-serif'
  ctx.fillText('Steak', 0, -22)
  ctx.font = '800 40px Syne, Outfit, sans-serif'
  ctx.fillText(`${streak} x ${multiplier}`, 0, 16)
  ctx.restore()
}

function drawImmortal(ctx: CanvasRenderingContext2D, immortal: boolean, now: number, popAt: number) {
  if (!immortal) return
  const age = now - popAt
  const pop = age < 220 ? 1.16 : 1
  ctx.save()
  ctx.translate(BOARD_W / 2, BOARD_H / 2 - 28)
  ctx.scale(pop, pop)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255, 196, 92, 0.9)'
  ctx.font = '800 46px Syne, Outfit, sans-serif'
  ctx.fillText('IMMORTAL', 0, 0)
  ctx.restore()
}

function bodyColor(t: number, flash: boolean, dancing = false): string {
  const head: [number, number, number] = flash ? [255, 168, 156] : dancing ? [246, 255, 140] : [214, 255, 120]
  const tail: [number, number, number] = flash ? [176, 54, 46] : [22, 112, 94]
  const r = Math.round(head[0] + (tail[0] - head[0]) * t)
  const g = Math.round(head[1] + (tail[1] - head[1]) * t)
  const b = Math.round(head[2] + (tail[2] - head[2]) * t)
  return `rgb(${r} ${g} ${b})`
}
