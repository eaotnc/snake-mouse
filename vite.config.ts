import type { IncomingMessage, ServerResponse } from 'node:http'
import { neon } from '@neondatabase/serverless'
import react from '@vitejs/plugin-react'
import { loadEnv, type Connect, type Plugin, defineConfig } from 'vite'

function scoresApi(): Plugin {
  const handle = async (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
    const url = req.url?.split('?')[0]
    if (url !== '/api/scores') return next()

    const env = loadEnv(process.env.NODE_ENV === 'production' ? 'production' : 'development', process.cwd(), '')
    const databaseUrl = env.DATABASE_URL
    if (!databaseUrl) {
      send(res, 503, { error: 'Scoreboard is not configured.' })
      return
    }

    try {
      const sql = neon(databaseUrl)
      await sql`
        CREATE TABLE IF NOT EXISTS scores (
          id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          name text NOT NULL,
          score integer NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `
      if (req.method === 'GET') {
        const rows = await sql`
          SELECT id, name, score
          FROM scores
          ORDER BY score DESC, created_at ASC
          LIMIT 10
        `
        send(res, 200, { rows })
        return
      }
      if (req.method === 'POST') {
        const raw = await readBody(req)
        const body = JSON.parse(raw) as { name?: unknown; score?: unknown }
        const name = typeof body.name === 'string' ? body.name.trim().slice(0, 16) : ''
        const score = typeof body.score === 'number' ? Math.floor(body.score) : NaN
        if (!name || !Number.isFinite(score) || score < 0) {
          send(res, 400, { error: 'Name and score are required.' })
          return
        }
        await sql`INSERT INTO scores (name, score) VALUES (${name}, ${score})`
        send(res, 201, { ok: true })
        return
      }
      send(res, 405, { error: 'Method not allowed.' })
    } catch {
      send(res, 500, { error: 'Could not reach the scoreboard.' })
    }
  }

  return {
    name: 'scores-api',
    configureServer(server) {
      server.middlewares.use(handle)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle)
    },
  }
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

export default defineConfig({
  plugins: [scoresApi(), react()],
})
