# Snake Mouse

A hover maze. The cursor is the snake’s head. Guide it through five stone mazes, eat bait to grow, and don’t click.

## Play

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://127.0.0.1:5173/`).

```bash
npm run build
npm run preview
```

## Rules

- Hover the lime ring to pick the snake up. After that, the cursor is the head and the body follows.
- Eat the gold bait. Each bite adds 1 length.
- A click or a wall takes 1 length. Penalties have a short recovery, so sitting on a wall does not drain you every frame.
- You start at length 3. Drop below 1 and the run is over.
- Five stages. Eat 5, then 10, 15, 20, and 25 bait. Each stage starts again at length 3.
- Every stage has at least three stone walls. The border is the only rounded frame.
- **Clicks** and **Hits** count the penalties that actually landed. They add up across the whole run.
- A synthesized song plays during a run and through a stage clear. It stops on a win or a game over.
- **Sound on / Sound off** mutes the song and the effects, and the browser remembers the choice.

## Stack

React, TypeScript, and Vite. The maze is drawn on a canvas. The snake samples an offscreen mask for wall collisions, and the music is generated with the Web Audio API.
