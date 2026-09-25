export type SoundName = 'eat' | 'streak' | 'click' | 'wall' | 'gameover' | 'clear' | 'win' | 'start' | 'latch'

const STORAGE_KEY = 'snake-mouse-muted'

let muted = false
let audio: AudioContext | null = null
let noiseBuffer: AudioBuffer | null = null

export function loadMuted() {
  try {
    muted = localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    muted = false
  }
  return muted
}

export function getMuted() {
  return muted
}

export function setMuted(value: boolean) {
  muted = value
  if (value) stopMusic()
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    // Ignore private-mode storage failures.
  }
}

export async function unlockAudio() {
  const ctx = getAudio()
  if (ctx && ctx.state === 'suspended') await ctx.resume()
}

export function playSound(name: SoundName) {
  if (muted) return
  const ctx = getAudio()
  if (!ctx || ctx.state !== 'running') return
  const now = ctx.currentTime

  if (name === 'eat') bite(ctx, now)
  else if (name === 'streak') streakHit(ctx, now)
  else if (name === 'click') click(ctx, now)
  else if (name === 'wall') thud(ctx, now)
  else if (name === 'gameover') sigh(ctx, now)
  else if (name === 'clear') chime(ctx, now, [523, 659, 784])
  else if (name === 'win') chime(ctx, now, [523, 659, 784, 1046])
  else if (name === 'start') knock(ctx, now)
  else whoosh(ctx, now)
}

function bite(ctx: AudioContext, when: number) {
  burst(ctx, when, 0.045, 0.16, { type: 'highpass', freq: 1400, q: 0.6 })
  burst(ctx, when + 0.04, 0.05, 0.08, { type: 'bandpass', freq: 900, q: 1.4 })
  tone(ctx, 320, 140, when, 0.09, 0.07)
}

function streakHit(ctx: AudioContext, when: number) {
  burst(ctx, when, 0.09, 0.34, { type: 'lowpass', freq: 220, endFreq: 70, q: 0.7 })
  burst(ctx, when, 0.14, 0.22, { type: 'bandpass', freq: 700, endFreq: 3200, q: 0.8 })
  tone(ctx, 196, 392, when, 0.18, 0.2)
  bell(ctx, 523, when, 0.32, 0.14)
  bell(ctx, 659, when + 0.05, 0.36, 0.12)
  bell(ctx, 784, when + 0.1, 0.42, 0.13)
}

function click(ctx: AudioContext, when: number) {
  burst(ctx, when, 0.018, 0.2, { type: 'highpass', freq: 2200, q: 0.7 })
  tone(ctx, 1600, 900, when, 0.03, 0.03)
}

function thud(ctx: AudioContext, when: number) {
  tone(ctx, 110, 48, when, 0.22, 0.2)
  burst(ctx, when, 0.09, 0.22, { type: 'lowpass', freq: 420, endFreq: 140, q: 0.8 })
  burst(ctx, when, 0.02, 0.08, { type: 'highpass', freq: 1800, q: 0.5 })
}

function sigh(ctx: AudioContext, when: number) {
  tone(ctx, 240, 90, when, 0.55, 0.06)
  burst(ctx, when, 0.6, 0.08, { type: 'lowpass', freq: 900, endFreq: 180, q: 0.6 })
}

function knock(ctx: AudioContext, when: number) {
  tap(ctx, when, 0.09)
  tap(ctx, when + 0.11, 0.06)
}

function tap(ctx: AudioContext, when: number, peak: number) {
  burst(ctx, when, 0.02, peak * 0.7, { type: 'bandpass', freq: 480, q: 1.2 })
  tone(ctx, 196, 120, when, 0.08, peak)
}

function whoosh(ctx: AudioContext, when: number) {
  burst(ctx, when, 0.14, 0.07, { type: 'bandpass', freq: 360, endFreq: 1600, q: 1.6 })
}

function chime(ctx: AudioContext, when: number, notes: number[]) {
  notes.forEach((frequency, index) => bell(ctx, frequency, when + index * 0.11, 0.55, 0.05))
}

function bell(ctx: AudioContext, frequency: number, when: number, duration: number, peak: number) {
  const partials = [
    { ratio: 1, amp: 1, decay: 1 },
    { ratio: 2.01, amp: 0.42, decay: 0.72 },
    { ratio: 2.76, amp: 0.22, decay: 0.5 },
    { ratio: 5.4, amp: 0.08, decay: 0.28 },
  ]
  for (const partial of partials) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(frequency * partial.ratio, when)
    const gain = ctx.createGain()
    const level = Math.max(0.0001, peak * partial.amp)
    const decay = duration * partial.decay
    gain.gain.setValueAtTime(0.0001, when)
    gain.gain.exponentialRampToValueAtTime(level, when + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + decay)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(when)
    osc.stop(when + decay + 0.02)
  }
}

function tone(
  ctx: AudioContext,
  from: number,
  to: number,
  when: number,
  duration: number,
  peak: number,
) {
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(from, when)
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, to), when + duration)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, when)
  gain.gain.exponentialRampToValueAtTime(peak, when + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(when)
  osc.stop(when + duration + 0.02)
}

function burst(
  ctx: AudioContext,
  when: number,
  duration: number,
  peak: number,
  shape: { type: BiquadFilterType; freq: number; endFreq?: number; q: number },
) {
  const src = ctx.createBufferSource()
  const buffer = getNoise(ctx)
  src.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = shape.type
  filter.Q.value = shape.q
  filter.frequency.setValueAtTime(shape.freq, when)
  if (shape.endFreq) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, shape.endFreq), when + duration)
  }
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(peak, when)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  const offset = Math.random() * Math.max(0, buffer.duration - duration - 0.01)
  src.start(when, offset, duration)
}

function getNoise(ctx: AudioContext) {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  noiseBuffer = buffer
  return buffer
}

function getAudio() {
  if (typeof window === 'undefined' || !window.AudioContext) return null
  if (!audio) audio = new AudioContext()
  return audio
}

let bpm = 100

function stepDuration() {
  return 60 / bpm / 4
}

export function setMusicBpm(next: number) {
  const clamped = Math.max(40, Math.min(220, next))
  if (Math.abs(clamped - bpm) < 0.5) return
  bpm = clamped
}
const LEAD = [76, 0, 79, 81, 84, 81, 79, 76, 79, 81, 84, 86, 88, 86, 84, 81]
const BASS = [48, 0, 0, 0, 55, 0, 0, 48, 53, 0, 0, 0, 55, 0, 48, 0]
const METAL = [40, 40, 40, 43, 40, 47, 40, 43, 40, 40, 38, 40, 35, 40, 43, 47]

let musicGain: GainNode | null = null
let musicTimer = 0
let musicStep = 0
let musicTime = 0
let musicOn = false
let metal = false

export function setMetalMusic(on: boolean) {
  metal = on
}

export function startMusic() {
  if (muted || musicOn) return
  const ctx = getAudio()
  if (!ctx || ctx.state !== 'running') return
  musicOn = true
  musicGain = ctx.createGain()
  musicGain.gain.setValueAtTime(0.9, ctx.currentTime)
  musicGain.connect(ctx.destination)
  musicStep = 0
  musicTime = ctx.currentTime + 0.06
  window.clearInterval(musicTimer)
  musicTimer = window.setInterval(scheduleMusic, 40)
  scheduleMusic()
}

export function stopMusic() {
  setMusicBpm(100)
  metal = false
  musicOn = false
  window.clearInterval(musicTimer)
  musicTimer = 0
  const ctx = audio
  const gain = musicGain
  musicGain = null
  if (!ctx || !gain) return
  const now = ctx.currentTime
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(gain.gain.value, now)
  gain.gain.linearRampToValueAtTime(0.0001, now + 0.12)
  window.setTimeout(() => gain.disconnect(), 180)
}

function scheduleMusic() {
  const ctx = audio
  if (!ctx || !musicOn || !musicGain) return
  const horizon = ctx.currentTime + 0.25
  while (musicTime < horizon) {
    const leadPattern = metal ? METAL : LEAD
    const bassPattern = metal ? METAL : BASS
    const index = musicStep % leadPattern.length
    if (metal) {
      if (index % 2 === 0) musicKick(ctx, musicTime, 0.28)
      if (index % 4 === 2) musicClap(ctx, musicTime)
    } else {
      if (index % 8 === 0) musicKick(ctx, musicTime, 0.16)
      if (index % 8 === 4) musicClap(ctx, musicTime)
      musicHat(ctx, musicTime, index % 2 === 0 ? 0.035 : 0.02)
    }
    const lead = leadPattern[index]
    const step = stepDuration()
    if (lead) musicNote(ctx, midi(lead), musicTime, step * (metal ? 0.45 : 0.92), metal ? 'sawtooth' : 'square', metal ? 0.07 : 0.045)
    const bass = bassPattern[index]
    if (bass) musicNote(ctx, midi(bass), musicTime, step * (metal ? 0.4 : 1.5), metal ? 'square' : 'triangle', metal ? 0.11 : 0.09)
    musicTime += step
    musicStep += 1
  }
}

function midi(note: number) {
  return 440 * 2 ** ((note - 69) / 12)
}

function musicNote(
  ctx: AudioContext,
  frequency: number,
  when: number,
  duration: number,
  type: OscillatorType,
  peak: number,
) {
  if (!musicGain) return
  const osc = ctx.createOscillator()
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(frequency * 4, when)
  filter.frequency.exponentialRampToValueAtTime(Math.max(180, frequency), when + duration)
  osc.type = type
  osc.frequency.setValueAtTime(frequency, when)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, when)
  gain.gain.exponentialRampToValueAtTime(peak, when + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration)
  osc.connect(filter)
  filter.connect(gain)
  gain.connect(musicGain)
  osc.start(when)
  osc.stop(when + duration + 0.02)
}

function musicKick(ctx: AudioContext, when: number, peak = 0.16) {
  if (!musicGain) return
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(150, when)
  osc.frequency.exponentialRampToValueAtTime(48, when + 0.12)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(peak, when)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.16)
  osc.connect(gain)
  gain.connect(musicGain)
  osc.start(when)
  osc.stop(when + 0.18)
}

function musicHat(ctx: AudioContext, when: number, peak: number) {
  if (!musicGain) return
  const src = ctx.createBufferSource()
  src.buffer = getNoise(ctx)
  const filter = ctx.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = 7000
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(peak, when)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.04)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(musicGain)
  src.start(when, Math.random() * 0.8, 0.04)
}

function musicClap(ctx: AudioContext, when: number) {
  if (!musicGain) return
  const src = ctx.createBufferSource()
  src.buffer = getNoise(ctx)
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 1800
  filter.Q.value = 0.7
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.07, when)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.1)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(musicGain)
  src.start(when, Math.random() * 0.7, 0.1)
}
