import { useState } from 'react'
import { LEVEL_QUOTAS } from './constants'
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
        <div>
          <h1>Snake Mouse</h1>
          <p className="tag">Five mazes. Don&apos;t click.</p>
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
            </div>
          )}
          <button
            type="button"
            className="sound"
            aria-pressed={muted}
            onClick={toggleSound}
          >
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
            <li>Eat bait to grow. Stages ask for 5, then 10, 15, 20, and 25.</li>
            <li>A click or a wall shortens the snake. Drop below 1 and it&apos;s over.</li>
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
            Length is {hud.length}. Stage {hud.level + 1} needs {LEVEL_QUOTAS[hud.level]} bait.
            Hover the ring to pick the snake back up.
          </p>
          <button type="button" onClick={onNext}>
            Continue
          </button>
        </div>
      </div>
    )
  }

  if (hud.phase === 'won') {
    return (
      <div className="overlay">
        <div className="card">
          <h2>Maze cleared</h2>
          <p>All five stages are done. The snake grew to length {hud.length}.</p>
          <button type="button" onClick={onRestart}>
            Play again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="overlay">
      <div className="card">
        <h2>Game over</h2>
        <p>The snake dropped below 1. Walls and clicks both take a length.</p>
        <button type="button" onClick={onRestart}>
          Play again
        </button>
      </div>
    </div>
  )
}
