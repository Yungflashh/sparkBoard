# Sparkboard

A drag-and-drop component builder: drag parts from the left palette onto the canvas,
then connect them by dragging from a node's right-side dot to another node.

## Run it

```
npm install
npm run dev
```

Then open the local URL Vite prints (usually http://localhost:5173).

## How it works

- **Add a component**: drag any item from the left sidebar onto the canvas. Drop
  position becomes the node's position.
- **Move a component**: mousedown and drag the node body.
- **Connect two components**: mousedown on the small filled dot on a node's right
  edge, drag to the target node, release. A curved line is drawn between them.
- **Delete a connection**: click on the line.
- **Delete a node**: right-click it (also removes any connections touching it).
- **Undo / Redo**: toolbar buttons, backed by a full state snapshot stack.
- **Zoom / pan**: scroll wheel to zoom (centered on the cursor), click-drag on
  empty canvas space to pan. "Reset view" restores the default viewBox.
- **Save / Load**: "Save" writes the current nodes and connections to
  `localStorage`; "Load" restores the last saved layout. This is a simple
  starting point — swap it for a backend call if you need shared/persisted
  layouts across devices.

## Where to extend this

- `PALETTE` in `src/App.jsx` is just an array of `{ type, label, color }` —
  add as many component types as you want, or swap the colored dot for a
  real icon.
- Connections are stored as plain `{ id, from, to }` objects, so it's
  straightforward to add validation rules (e.g. "a wheel can only connect to
  an axle") by checking node types before committing a new connection in
  `handleConnectMouseUp`.
- All mutations go through `commit()`, which is also what powers undo/redo —
  any new feature that changes `nodes`/`connections` should go through it so
  undo keeps working.
- No canvas library is used (just SVG + React state), so the whole
  interaction model is readable in one file if you want to understand or
  rewrite it — see `src/App.jsx`.
