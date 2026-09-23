export type Point = { x: number; y: number }

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/** Keep the head and drop the tail so the trail's arc length is at most maxLen. */
export function trimPath(path: Point[], maxLen: number) {
  if (path.length === 0) return
  if (maxLen <= 0) {
    const head = path[path.length - 1]
    path.length = 0
    path.push(head)
    return
  }

  let acc = 0
  for (let i = path.length - 1; i > 0; i--) {
    const seg = dist(path[i], path[i - 1])
    if (acc + seg >= maxLen) {
      const remain = maxLen - acc
      const t = seg === 0 ? 0 : remain / seg
      const cut = lerp(path[i], path[i - 1], t)
      const keep = path.slice(i)
      path.length = 0
      path.push(cut, ...keep)
      return
    }
    acc += seg
  }
}

/** Points from the head backward, spaced evenly along the trail. */
export function resampleFromHead(path: Point[], spacing: number): Point[] {
  if (path.length === 0) return []
  const out: Point[] = [path[path.length - 1]]
  if (path.length === 1) return out

  let leftover = spacing
  for (let i = path.length - 1; i > 0; i--) {
    let from = path[i]
    const toward = path[i - 1]
    let seg = dist(from, toward)
    if (seg === 0) continue
    while (leftover <= seg) {
      const t = leftover / seg
      const next = lerp(from, toward, t)
      out.push(next)
      from = next
      seg -= leftover
      leftover = spacing
    }
    leftover -= seg
  }

  const tail = path[0]
  const last = out[out.length - 1]
  if (dist(last, tail) > 0.5) out.push(tail)
  return out
}

/** Corner-cutting that leaves the head and tail pinned. */
export function smoothOpen(points: Point[]): Point[] {
  if (points.length < 3) return points
  const out: Point[] = [points[0]]
  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i]
    const q = points[i + 1]
    out.push({ x: p.x * 0.75 + q.x * 0.25, y: p.y * 0.75 + q.y * 0.25 })
    out.push({ x: p.x * 0.25 + q.x * 0.75, y: p.y * 0.25 + q.y * 0.75 })
  }
  out.push(points[points.length - 1])
  return out
}
