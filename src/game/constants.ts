export let BOARD_W = 960
export let BOARD_H = 600

export function setPortraitBoard(portrait: boolean) {
  BOARD_W = portrait ? 600 : 960
  BOARD_H = portrait ? 960 : 600
}

export function boardIsPortrait() {
  return BOARD_H > BOARD_W
}
export const START_LENGTH = 3
export const MAX_LENGTH = 15
export const BAIT_TTL_MS = 2000
export const LEVEL_TIME_MS = 60_000
export const BITE_TIME_MS = 500

/** Stage 1 asks for 10, then 15, 20, 25, and so on. */
export function quotaFor(levelIndex: number) {
  return 10 + levelIndex * 5
}
export const SEGMENT_PX = 36
export const PENALTY_MS = 400
export const HEAD_RADIUS = 13
export const HEAD_HIT_RADIUS = 10
export const BAIT_RADIUS = 12
export const LATCH_RADIUS = 36
