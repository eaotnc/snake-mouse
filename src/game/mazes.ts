import { BOARD_H, BOARD_W } from './constants'
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
    x: 18,
    y: 18,
    w: BOARD_W - 36,
    h: BOARD_H - 36,
    r: 30,
    thickness: 36,
  }
}

export const MAZES: Maze[] = [
  {
    start: { x: 150, y: 300 },
    walls: [
      frame(),
      { kind: 'blob', x: 300, y: 80, w: 36, h: 160, r: 18 },
      { kind: 'blob', x: 470, y: 250, w: 170, h: 36, r: 18 },
      { kind: 'blob', x: 180, y: 420, w: 260, h: 36, r: 18 },
      { kind: 'blob', x: 700, y: 160, w: 36, h: 200, r: 18 },
    ],
  },
  {
    start: { x: 120, y: 100 },
    walls: [
      frame(),
      { kind: 'blob', x: 210, y: 155, w: 640, h: 36, r: 18 },
      { kind: 'blob', x: 110, y: 300, w: 640, h: 36, r: 18 },
      { kind: 'blob', x: 210, y: 445, w: 640, h: 36, r: 18 },
      { kind: 'blob', x: 480, y: 225, w: 36, h: 40, r: 12 },
    ],
  },
  {
    start: { x: 120, y: 300 },
    walls: [
      frame(),
      { kind: 'blob', x: 220, y: 120, w: 380, h: 36, r: 18 },
      { kind: 'blob', x: 360, y: 240, w: 36, h: 170, r: 18 },
      { kind: 'blob', x: 200, y: 460, w: 280, h: 36, r: 18 },
      { kind: 'blob', x: 690, y: 400, w: 36, h: 140, r: 18 },
    ],
  },
  {
    start: { x: 120, y: 300 },
    walls: [
      frame(),
      { kind: 'blob', x: 230, y: 70, w: 36, h: 210, r: 18 },
      { kind: 'blob', x: 230, y: 370, w: 36, h: 170, r: 18 },
      { kind: 'blob', x: 430, y: 70, w: 36, h: 150, r: 18 },
      { kind: 'blob', x: 430, y: 310, w: 36, h: 230, r: 18 },
      { kind: 'blob', x: 630, y: 150, w: 36, h: 210, r: 18 },
      { kind: 'blob', x: 630, y: 450, w: 36, h: 100, r: 18 },
    ],
  },
  {
    start: { x: 120, y: 110 },
    walls: [
      frame(),
      { kind: 'blob', x: 400, y: 210, w: 170, h: 30, r: 15 },
      { kind: 'blob', x: 600, y: 70, w: 30, h: 150, r: 15 },
      { kind: 'blob', x: 160, y: 430, w: 150, h: 30, r: 15 },
      { kind: 'blob', x: 760, y: 300, w: 36, h: 160, r: 15 },
    ],
  },
]
