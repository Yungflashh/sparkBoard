# Drag & Connect Circles

A minimal drag-and-connect workspace built with Vite + React 18.

Drag the circle from the left column onto the workspace, then drag from a placed
circle's right dot to another circle to connect them with a line.

## Run it

```
npm install
npm run dev
```

Then open the local URL Vite prints (usually http://localhost:5173).

## What it does

- **Column (left)**: a single reusable "Circle" item.
- **Workspace (right)**: an SVG canvas where dropped circles live.
- **Drag & drop** the Circle from the column onto the workspace to place a new circle. Do it twice to have two.
- **Move** a placed circle by dragging its body.
- **Connect two circles**: click one circle (it lights up orange), then click another circle. A line is drawn between them.
- **Cancel a pending connection**: click empty workspace.
- **Delete a connection**: click on the line.
- **Delete a circle**: right-click it (also removes any lines touching it).

That is intentionally the whole feature set.

## Files

- `src/App.jsx` — the whole app (state, event handlers, and JSX in one component).
- `src/main.jsx` — Vite/React entry point.
- `src/index.css` — a handful of resets.
- `index.html` — Vite's HTML shell.
