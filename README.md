# Robokido IDE

Visual programming for the Robokido humanoid. Vite + React.

```
npm i
npm run dev
```

Then http://localhost:5173.

Every robot has its own Division 1, Division 2, … and every Division has its own Sub 1, Sub 2, … (reusable groups that chain into a sequence). Drag blocks from the left palette into a subdivision.

Any number field (Repeat times, For from/to, conditions, motion time/speed/degree) has a `123 / x` switch in front of it: `123` takes a typed number, `x` takes another variable's name. Use the `Set` control block to define variables, e.g. `Z = W`. In the JSON, a variable shows up as `{ "var": "W" }` and a number as a plain number. Hit Preview to run the program on a stick figure; flip on Mission mode and the robot has to walk to an apple and carry it home.

SEND copies the JSON payload to clipboard. Point Settings → endpoint at your robot to POST instead.
