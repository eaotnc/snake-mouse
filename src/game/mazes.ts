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
      { kind: 'disc', x: 390, y: 168, r: 54 },
      { kind: 'disc', x: 640, y: 430, r: 62 },
      { kind: 'disc', x: 790, y: 190, r: 40 },
      { kind: 'blob', x: 470, y: 250, w: 170, h: 36, r: 18 },
      { kind: 'blob', x: 690, y: 340, w: 130, h: 96, r: 42 },
      {
        kind: 'arc',
        cx: 520,
        cy: 530,
        r: 150,
        start: Math.PI * 1.12,
        end: Math.PI * 1.88,
        thickness: 34,
      },
    ],
  },
  {
    start: { x: 120, y: 100 },
    walls: [
      frame(),
      { kind: 'blob', x: 210, y: 155, w: 640, h: 36, r: 18 },
      { kind: 'blob', x: 110, y: 300, w: 640, h: 36, r: 18 },
      { kind: 'blob', x: 210, y: 445, w: 640, h: 36, r: 18 },
      { kind: 'disc', x: 820, y: 230, r: 34 },
      { kind: 'disc', x: 170, y: 510, r: 32 },
      { kind: 'disc', x: 700, y: 78, r: 28 },
      {
        kind: 'arc',
        cx: 520,
        cy: 18,
        r: 70,
        start: Math.PI * 0.22,
        end: Math.PI * 0.78,
        thickness: 30,
      },
    ],
  },
  {
    start: { x: 120, y: 300 },
    walls: [
      frame(),
      {
        kind: 'arc',
        cx: 500,
        cy: 300,
        r: 168,
        start: Math.PI + 0.55,
        end: Math.PI * 3 - 0.55,
        thickness: 36,
      },
      { kind: 'disc', x: 500, y: 300, r: 46 },
      { kind: 'disc', x: 250, y: 140, r: 38 },
      { kind: 'disc', x: 250, y: 470, r: 38 },
      { kind: 'blob', x: 700, y: 80, w: 120, h: 120, r: 48 },
      { kind: 'blob', x: 690, y: 400, w: 36, h: 140, r: 18 },
      {
        kind: 'arc',
        cx: 780,
        cy: 250,
        r: 70,
        start: Math.PI * 0.4,
        end: Math.PI * 1.7,
        thickness: 28,
      },
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
      { kind: 'disc', x: 820, y: 130, r: 36 },
      { kind: 'disc', x: 830, y: 470, r: 40 },
      { kind: 'blob', x: 740, y: 230, w: 120, h: 110, r: 46 },
      {
        kind: 'arc',
        cx: 330,
        cy: 500,
        r: 90,
        start: Math.PI * 1.05,
        end: Math.PI * 1.95,
        thickness: 30,
      },
    ],
  },
  {
    start: { x: 120, y: 110 },
    walls: [
      frame(),
      {
        kind: 'arc',
        cx: 270,
        cy: 280,
        r: 112,
        start: 0.45,
        end: Math.PI * 2 - 0.55,
        thickness: 32,
      },
      {
        kind: 'arc',
        cx: 690,
        cy: 390,
        r: 108,
        start: Math.PI + 0.6,
        end: Math.PI * 3 - 0.6,
        thickness: 30,
      },
      { kind: 'disc', x: 490, y: 150, r: 34 },
      { kind: 'disc', x: 530, y: 310, r: 30 },
      { kind: 'disc', x: 360, y: 470, r: 36 },
      { kind: 'disc', x: 820, y: 150, r: 32 },
      { kind: 'blob', x: 400, y: 210, w: 170, h: 30, r: 15 },
      { kind: 'blob', x: 600, y: 70, w: 30, h: 150, r: 15 },
      { kind: 'blob', x: 160, y: 430, w: 150, h: 30, r: 15 },
      { kind: 'blob', x: 720, y: 250, w: 100, h: 86, r: 36 },
    ],
  },
]
