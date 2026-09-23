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
- Five stages. Eat 5, then 10, 15, 20, and 25 bait. Length carries into the next stage.
- **Clicks** and **Hits** count the penalties that actually landed.
- **Sound on / Sound off** is remembered in the browser.

## Stack

React, TypeScript, and Vite. The maze is drawn on a canvas. Walls are stone shapes with round edges, and the snake samples an offscreen mask so those curves collide.
