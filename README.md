# Robokido IDE

Drag-and-drop programming for the Robokido humanoid robot. React + Vite.

```
npm install
npm run dev
```

Then open http://localhost:5173.

## What's in it

- Motion and control block palettes on the left.
- A working space with Divisions (one per robot) and Subdivisions (reusable sequences of blocks).
- A Debug / IDE panel showing live logs or the serialized JSON payload.
- A Preview with a stick humanoid that acts out the program; a Mission mode drops an apple and a house on the stage and tracks a three-step objective.
- Settings for robot list and backend endpoint. Programs save to localStorage.

## Layout

- `src/App.jsx` — most of the app.
- `src/PreviewModal.jsx` — the preview + mission.
- `src/preview.js` — pose model, timeline flattening, duration scaling.
- `src/blocks.js` — motion and control block definitions.
- `src/index.css` — styles.

Not wired to a real robot yet. The backend endpoint field in Settings is where you'd POST to.
