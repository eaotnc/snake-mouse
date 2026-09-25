import { useEffect, useState } from 'react'
import { quotaFor } from './constants'
import { fetchScores, saveScore, type ScoreRow } from './scores'
import { getMuted, loadMuted, setMuted, startMusic, unlockAudio } from './sound'
import { useSnakeGame, type Hud } from './useSnakeGame'

export default function SnakeGame() {
  const { canvasRef, hud, startGame, nextLevel, onPointerMove, onPointerLeave, onPointerDown } =
    useSnakeGame()
  const [muted, setMutedOn] = useState(loadMuted)

  const toggleSound = () => {
    const next = !getMuted()
    setMuted(next)
    setMutedOn(next)
    if (!next) {
      void unlockAudio().then(() => {
        if (hud.phase === 'playing' || hud.phase === 'levelClear') startMusic()
      })
    }
  }

  return (
    <div className="layout">
      <header className="top">
        <div className="brand">
          <h1>Snake Mouse</h1>
          <p className="tag">Don&apos;t click.</p>
        </div>
        <div className="hud">
          {hud.phase !== 'menu' && (
            <div className="stats" aria-live="polite">
              <span className="stat">
                Level <strong>{hud.level}</strong>
              </span>
              <span className="stat">
                Bait{' '}
                <strong>
                  {hud.baits}/{hud.quota}
                </strong>
              </span>
              <span className={hud.length <= 1 ? 'stat danger' : 'stat'}>
                Length <strong>{hud.length}</strong>
              </span>
              <span className="stat">
                Clicks <strong>{hud.clicks}</strong>
              </span>
              <span className="stat">
                Hits <strong>{hud.hits}</strong>
              </span>
              <span className="stat">
                Score <strong>{hud.score}</strong>
              </span>
              {hud.streak > 0 && (
                <span className="stat">
                  Streak <strong>{hud.streak}</strong>
                </span>
              )}
              <span className={hud.timeLeft <= 15 ? 'stat danger' : 'stat'}>
                Time <strong>{hud.timeLeft.toFixed(1)}</strong>
              </span>
            </div>
          )}
          <button type="button" className="sound" aria-pressed={muted} onClick={toggleSound}>
            {muted ? 'Sound off' : 'Sound on'}
          </button>
        </div>
      </header>

      <div className="stage">
        <canvas
          ref={canvasRef}
          width={960}
          height={600}
          aria-label="Snake mouse playfield"
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          onPointerDown={onPointerDown}
          onContextMenu={(event) => event.preventDefault()}
        />
        <Overlay hud={hud} onStart={startGame} onNext={nextLevel} onRestart={startGame} />
      </div>
    </div>
  )
}

function Overlay({
  hud,
  onStart,
  onNext,
  onRestart,
}: {
  hud: Hud
  onStart: () => void
  onNext: () => void
  onRestart: () => void
}) {
  if (hud.phase === 'playing') return null

  if (hud.phase === 'menu') {
    return (
      <div className="overlay">
        <div className="card">
          <h2>How to play</h2>
          <ul className="rules">
            <li>The cursor is the head. Hover to move through the maze.</li>
            <li>Eat within 1 second for 2 points, or before the bait moves for 1. Three fast bites in a row start a streak: x2 at 3, x3 at 8, x5 at 12.</li>
            <li>Each stage has 20 seconds. A bite adds half a second. The snake stops growing at 15.</li>
          </ul>
          <button type="button" onClick={onStart}>
            Start
          </button>
        </div>
      </div>
    )
  }

  if (hud.phase === 'levelClear') {
    return (
      <div className="overlay">
        <div className="card">
          <h2>Stage {hud.level} clear</h2>
          <p>
            Stage {hud.level + 1} starts at length 3 and needs {quotaFor(hud.level)} bait.
            Hover the ring to pick the snake back up.
          </p>
          <button type="button" onClick={onNext}>
            Continue
          </button>
        </div>
      </div>
    )
  }

  return <GameOver hud={hud} onRestart={onRestart} />
}

function GameOver({ hud, onRestart }: { hud: Hud; onRestart: () => void }) {
  const [name, setName] = useState('')
  const [rows, setRows] = useState<ScoreRow[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void fetchScores().then((result) => {
      setRows(result.rows)
      setMessage(result.error)
    })
  }, [])

  const submit = async () => {
    const error = await saveScore(name.trim().slice(0, 16), hud.score)
    if (error) {
      setMessage(error)
      return
    }
    setSaved(true)
    const result = await fetchScores()
    setRows(result.rows)
    setMessage(result.error)
  }

  return (
    <div className="overlay">
      <div className="card">
        <h2>Game over</h2>
        <p>
          Score {hud.score}. {hud.timeLeft <= 0 ? 'The clock ran out.' : 'The snake dropped below 1.'}
        </p>
        <form
          className="save-score"
          onSubmit={(event) => {
            event.preventDefault()
            if (!saved) void submit()
          }}
        >
          <input
            value={name}
            maxLength={16}
            placeholder="Name"
            aria-label="Name"
            disabled={saved}
            onChange={(event) => setName(event.target.value)}
          />
          <button type="submit" disabled={saved || name.trim().length === 0}>
            {saved ? 'Saved' : 'Save score'}
          </button>
        </form>
        {message && <p className="board-note">{message}</p>}
        <ol className="board">
          {rows.map((row) => (
            <li key={row.id}>
              <span>{row.name}</span>
              <strong>{row.score}</strong>
            </li>
          ))}
        </ol>
        <button type="button" onClick={onRestart}>
          Play again
        </button>
      </div>
    </div>
  )
}
