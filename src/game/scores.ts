export type ScoreRow = { id: number; name: string; score: number }

export async function fetchScores(): Promise<{ rows: ScoreRow[]; error: string | null }> {
  try {
    const response = await fetch('/api/scores')
    const body = (await response.json()) as { rows?: ScoreRow[]; error?: string }
    if (!response.ok) return { rows: [], error: body.error ?? 'Could not load the scoreboard.' }
    return { rows: body.rows ?? [], error: null }
  } catch {
    return { rows: [], error: 'Could not load the scoreboard.' }
  }
}

export async function saveScore(name: string, score: number): Promise<string | null> {
  try {
    const response = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, score }),
    })
    const body = (await response.json()) as { error?: string }
    if (!response.ok) return body.error ?? 'Could not save the score.'
    return null
  } catch {
    return 'Could not save the score.'
  }
}
