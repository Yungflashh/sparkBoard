import React, { useEffect, useMemo, useRef, useState } from 'react'

// ============================================================
// Constants
// ============================================================

const PALETTE_DEFAULTS = [
  { type: 'motor', label: 'Motor', color: '#378ADD', hint: 'Spins things' },
  { type: 'sensor', label: 'Sensor', color: '#1D9E75', hint: 'Reads the world' },
  { type: 'wheel', label: 'Wheel', color: '#D85A30', hint: 'Rolls around' },
  { type: 'arm', label: 'Arm', color: '#D4537E', hint: 'Reaches out' },
  { type: 'battery', label: 'Battery', color: '#BA7517', hint: 'Provides power' },
  { type: 'controller', label: 'Controller', color: '#534AB7', hint: 'The brain' },
]

const NODE_W = 116
const NODE_H = 44
const GRID = 20
const SNAP_THRESHOLD = 6
const MOBILE_BREAKPOINT = 760
const LONG_PRESS_MS = 500
const LONG_PRESS_MOVE_TOLERANCE = 8

const STORAGE_KEY = 'dot-connector-layout'
const PALETTE_KEY = 'dot-connector-palette'
const THEME_KEY = 'dot-connector-theme'
const TUTORIAL_KEY = 'dot-connector-tutorial-seen'

const COLOR_SWATCHES = [
  '#378ADD', '#1D9E75', '#D85A30', '#D4537E', '#BA7517', '#534AB7',
  '#c74a4a', '#4aa3c7', '#7ac74a', '#c7a04a', '#666666', '#111111',
]

// ============================================================
// Themes
// ============================================================

const THEMES = {
  light: {
    name: 'light',
    bg: '#f4f4f2', canvas: '#f7f6f2', panel: '#ffffff', toolbar: '#ffffff',
    border: '#d8d6cf', text: '#1c1c1a', muted: '#888', subtle: '#aaa',
    grid: '#e8e6df', paletteItem: '#faf9f6',
    help: { bg: '#fff8e1', border: '#f0e6b8', text: '#5c4a00' },
    tutorialBg: '#1c1c1a', tutorialFg: '#ffffff', tutorialAccent: '#f4d24d',
    nodeBg: '#ffffff', nodeText: '#1c1c1a',
    selected: '#111111', group: '#a99b6a', guide: '#e26aa5',
    toastBg: '#1c1c1a', toastFg: '#ffffff',
  },
  dark: {
    name: 'dark',
    bg: '#141519', canvas: '#1c1e24', panel: '#24252c', toolbar: '#24252c',
    border: '#3a3b42', text: '#eaeaea', muted: '#8a8b90', subtle: '#6a6b70',
    grid: '#2b2c33', paletteItem: '#2b2d34',
    help: { bg: '#3d3620', border: '#5a4e2a', text: '#e6d69a' },
    tutorialBg: '#f4d24d', tutorialFg: '#1c1c1a', tutorialAccent: '#1c1c1a',
    nodeBg: '#2b2d34', nodeText: '#eaeaea',
    selected: '#f4d24d', group: '#c4a95a', guide: '#f857c5',
    toastBg: '#eaeaea', toastFg: '#1c1c1a',
  },
}

// ============================================================
// Utilities
// ============================================================

let idCounter = 1
function nextId(prefix) {
  return `${prefix}-${idCounter++}-${Date.now().toString(36).slice(-3)}`
}
function snap(v) { return Math.round(v / GRID) * GRID }
function emptyState() { return { nodes: [], connections: [], groups: [] } }

function encodeState(state) {
  const json = JSON.stringify(state)
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function decodeState(encoded) {
  const s = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : ''
  const bin = atob(s + pad)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return JSON.parse(new TextDecoder().decode(bytes))
}

let _cachedInitial = null
function getInitial() {
  if (_cachedInitial) return _cachedInitial
  let out = { nodes: [], connections: [], groups: [], customPalette: [], fromShare: false }
  try {
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#s=')) {
      const parsed = decodeState(window.location.hash.slice(3))
      out = {
        nodes: parsed.nodes || [],
        connections: parsed.connections || [],
        groups: parsed.groups || [],
        customPalette: parsed.customPalette || [],
        fromShare: true,
      }
      _cachedInitial = out
      return out
    }
  } catch {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      out.nodes = parsed.nodes || []
      out.connections = parsed.connections || []
      out.groups = parsed.groups || []
    }
  } catch {}
  try {
    const raw = localStorage.getItem(PALETTE_KEY)
    if (raw) out.customPalette = JSON.parse(raw) || []
  } catch {}
  _cachedInitial = out
  return out
}

function computeSnap(dragged, others) {
  const dEdges = { x: [dragged.x, dragged.x + NODE_W / 2, dragged.x + NODE_W], y: [dragged.y, dragged.y + NODE_H / 2, dragged.y + NODE_H] }
  let bestX = null, bestY = null
  for (const o of others) {
    const ox = [o.x, o.x + NODE_W / 2, o.x + NODE_W]
    const oy = [o.y, o.y + NODE_H / 2, o.y + NODE_H]
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const diffX = ox[j] - dEdges.x[i]
        if (Math.abs(diffX) < SNAP_THRESHOLD && (!bestX || Math.abs(diffX) < Math.abs(bestX.diff))) {
          bestX = { diff: diffX, pos: ox[j] }
        }
        const diffY = oy[j] - dEdges.y[i]
        if (Math.abs(diffY) < SNAP_THRESHOLD && (!bestY || Math.abs(diffY) < Math.abs(bestY.diff))) {
          bestY = { diff: diffY, pos: oy[j] }
        }
      }
    }
  }
  const guides = []
  if (bestX) guides.push({ orient: 'v', pos: bestX.pos })
  if (bestY) guides.push({ orient: 'h', pos: bestY.pos })
  return { dx: bestX ? bestX.diff : 0, dy: bestY ? bestY.diff : 0, guides }
}

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y) }
function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }

// ============================================================
// Node icons
// ============================================================

function NodeIcon({ type, label, color, size = 16 }) {
  const s = size
  const half = s / 2
  const stroke = { stroke: color, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }
  const fill = { fill: color }
  switch (type) {
    case 'motor':
      return (
        <g>
          <circle r={half * 0.9} {...fill} />
          <circle r={half * 0.3} fill="#fff" />
        </g>
      )
    case 'sensor':
      return (
        <g>
          <polygon points={`0,${-half * 0.95} ${half * 0.95},0 0,${half * 0.95} ${-half * 0.95},0`} {...fill} />
          <circle r={half * 0.3} fill="#fff" />
        </g>
      )
    case 'wheel':
      return (
        <g>
          <circle r={half * 0.9} fill="none" stroke={color} strokeWidth={2} />
          <line x1={-half * 0.65} y1={0} x2={half * 0.65} y2={0} {...stroke} />
          <line x1={0} y1={-half * 0.65} x2={0} y2={half * 0.65} {...stroke} />
        </g>
      )
    case 'arm':
      return (
        <path
          d={`M ${-half * 0.7} ${half * 0.7} L ${-half * 0.7} ${-half * 0.55} L ${half * 0.5} ${-half * 0.55} L ${half * 0.5} ${half * 0.7}`}
          {...stroke}
          strokeWidth={2.2}
        />
      )
    case 'battery':
      return (
        <g>
          <rect x={-half * 0.85} y={-half * 0.55} width={s * 0.7} height={s * 0.55} rx={1.5} {...fill} />
          <rect x={half * 0.55} y={-half * 0.25} width={s * 0.12} height={s * 0.25} {...fill} />
        </g>
      )
    case 'controller':
      return (
        <g>
          <rect x={-half * 0.9} y={-half * 0.7} width={s * 0.9} height={s * 0.7} rx={2} {...fill} />
          <circle cx={-s * 0.18} cy={-s * 0.08} r={s * 0.08} fill="#fff" />
          <circle cx={s * 0.18} cy={-s * 0.08} r={s * 0.08} fill="#fff" />
          <rect x={-s * 0.18} y={s * 0.06} width={s * 0.36} height={s * 0.08} rx={1} fill="#fff" />
        </g>
      )
    default:
      return (
        <g>
          <circle r={half * 0.9} {...fill} />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={s * 0.75}
            fill="#fff"
            style={{ fontWeight: 700, userSelect: 'none' }}
          >
            {(label || '?').charAt(0).toUpperCase()}
          </text>
        </g>
      )
  }
}

function PaletteIcon({ type, label, color, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}>
      <NodeIcon type={type} label={label} color={color} size={size} />
    </svg>
  )
}

// ============================================================
// Reusable subcomponents
// ============================================================

function ContextMenu({ x, y, items, onClose, theme, isMobile }) {
  useEffect(() => {
    function onDown(e) {
      if (!e.target.closest('[data-ctxmenu]')) onClose()
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [onClose])
  const w = 180
  const clampedX = Math.min(x, (window.innerWidth || 400) - w - 8)
  return (
    <div
      data-ctxmenu
      style={{
        position: 'fixed', left: clampedX, top: y, minWidth: w,
        background: theme.panel, color: theme.text,
        border: `1px solid ${theme.border}`, borderRadius: 8, padding: 4,
        boxShadow: '0 6px 20px rgba(0,0,0,0.16)', zIndex: 25,
        touchAction: 'none',
      }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          onClick={() => { item.onClick(); onClose() }}
          style={{
            padding: isMobile ? '12px 14px' : '6px 12px',
            fontSize: isMobile ? 14 : 13,
            cursor: 'pointer',
            borderRadius: 4,
            color: item.danger ? '#d05353' : theme.text,
          }}
        >
          {item.label}
        </div>
      ))}
    </div>
  )
}

function TutorialCard({ step, theme, onNext, onSkip }) {
  const steps = [
    {
      modal: true,
      title: 'Welcome to Sparkboard',
      body: 'A simple canvas for showing how parts connect. Want a 30-second tour?',
      nextLabel: 'Yes, show me',
      skipLabel: 'Skip',
    },
    {
      title: 'Step 1 — Add a part',
      body: 'Drag any part from the panel on the left onto the big empty space. On phones, tap the "Parts" button to open the panel.',
    },
    {
      title: 'Step 2 — Add another part',
      body: 'Nice! Now drag one more part onto the canvas so we have two of them.',
    },
    {
      title: 'Step 3 — Connect them',
      body: "See the colored dot on the right of a part? Drag from it onto another part to link them.",
    },
    {
      modal: true,
      title: "You're all set!",
      body: 'Long-press (or right-click) a part for more options, double-tap to rename, and use the toolbar to save, share, or export.',
      nextLabel: 'Got it',
    },
  ]
  const s = steps[step]
  if (!s) return null

  if (s.modal) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40, padding: 16,
      }}>
        <div style={{
          background: theme.panel, color: theme.text, padding: 26, borderRadius: 14,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxWidth: 440, width: '100%',
          border: `1px solid ${theme.border}`,
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{s.title}</div>
          <div style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 20, color: theme.text }}>{s.body}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {s.skipLabel && <button onClick={onSkip}>{s.skipLabel}</button>}
            <button
              onClick={onNext}
              style={{ background: theme.tutorialBg, color: theme.tutorialFg, border: 'none', fontWeight: 600 }}
            >
              {s.nextLabel}
            </button>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div style={{
      position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
      background: theme.tutorialBg, color: theme.tutorialFg,
      padding: '12px 16px', borderRadius: 10, maxWidth: 380, width: 'calc(100% - 24px)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.24)', zIndex: 15, boxSizing: 'border-box',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{s.title}</div>
      <div style={{ fontSize: 12, lineHeight: 1.5 }}>{s.body}</div>
      <div style={{ marginTop: 8, display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
        <button
          onClick={onSkip}
          style={{ background: 'transparent', color: theme.tutorialFg, border: `1px solid ${theme.tutorialFg}`, opacity: 0.85 }}
        >
          Skip tour
        </button>
      </div>
    </div>
  )
}

function AddPartModal({ onSubmit, onClose, theme }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLOR_SWATCHES[6])
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40, padding: 16,
    }}>
      <div style={{
        background: theme.panel, color: theme.text, padding: 22, borderRadius: 12,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxWidth: 380, width: '100%',
        border: `1px solid ${theme.border}`,
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Add a new part</div>
        <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: theme.muted }}>Name</label>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Camera"
          style={{
            width: '100%', padding: 10, marginBottom: 14, borderRadius: 6,
            border: `1px solid ${theme.border}`, fontSize: 14,
            background: theme.bg, color: theme.text, boxSizing: 'border-box',
          }}
        />
        <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: theme.muted }}>Color</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {COLOR_SWATCHES.map(c => (
            <div
              key={c}
              onClick={() => setColor(c)}
              style={{
                width: 30, height: 30, borderRadius: '50%', background: c,
                boxShadow: color === c ? `0 0 0 3px ${theme.selected}` : 'none',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          style={{ width: '100%', height: 34, marginBottom: 18, border: 'none', background: 'transparent' }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose}>Cancel</button>
          <button
            disabled={!name.trim()}
            onClick={() => onSubmit(name.trim(), color)}
            style={{ background: theme.tutorialBg, color: theme.tutorialFg, border: 'none', fontWeight: 600 }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

// Set the theme attribute before React mounts to avoid a light-mode flash on load
try {
  if (typeof document !== 'undefined' && typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(THEME_KEY)
    document.documentElement.setAttribute('data-theme', stored === 'dark' ? 'dark' : 'light')
  }
} catch {}

// ============================================================
// Main App
// ============================================================

export default function App() {
  const initial = getInitial()

  const [nodes, setNodes] = useState(initial.nodes)
  const [connections, setConnections] = useState(initial.connections)
  const [groups, setGroups] = useState(initial.groups)
  const [palette, setPalette] = useState([...PALETTE_DEFAULTS, ...(initial.customPalette || [])])

  const [themeName, setThemeName] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light' } catch { return 'light' }
  })
  const theme = THEMES[themeName]

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
  )
  const [paletteOpen, setPaletteOpen] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth >= MOBILE_BREAKPOINT
  )
  useEffect(() => {
    function onResize() {
      const m = window.innerWidth < MOBILE_BREAKPOINT
      setIsMobile(m)
      if (!m) setPaletteOpen(true)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const undoStack = useRef([])
  const redoStack = useRef([])
  const [, forceRender] = useState(0)

  const nodesRef = useRef(nodes)
  const connectionsRef = useRef(connections)
  const groupsRef = useRef(groups)
  useEffect(() => { nodesRef.current = nodes }, [nodes])
  useEffect(() => { connectionsRef.current = connections }, [connections])
  useEffect(() => { groupsRef.current = groups }, [groups])

  const svgRef = useRef(null)
  const canvasWrapRef = useRef(null)
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 900, h: 560 })
  const viewBoxRef = useRef(viewBox)
  useEffect(() => { viewBoxRef.current = viewBox }, [viewBox])

  const connectingFromRef = useRef(null)
  const [ghostLine, setGhostLine] = useState(null)
  const [hoveredConnId, setHoveredConnId] = useState(null)

  const [selectedIds, setSelectedIds] = useState([])
  const selectedIdsRef = useRef(selectedIds)
  useEffect(() => { selectedIdsRef.current = selectedIds }, [selectedIds])

  const [renaming, setRenaming] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [showHelp, setShowHelp] = useState(false)
  const [toast, setToast] = useState(null)
  const [simulating, setSimulating] = useState(false)
  const [showAddPart, setShowAddPart] = useState(false)
  const [alignmentGuides, setAlignmentGuides] = useState([])
  const [rubberBand, setRubberBand] = useState(null)
  const rubberBandRef = useRef(null)
  useEffect(() => { rubberBandRef.current = rubberBand }, [rubberBand])

  // Palette pointer drag state
  const [paletteDragging, setPaletteDragging] = useState(null) // { item, x, y }
  const paletteDraggingRef = useRef(null)
  useEffect(() => { paletteDraggingRef.current = paletteDragging }, [paletteDragging])

  // Multi-touch
  const activePointersRef = useRef(new Map())
  const pinchRef = useRef(null)
  const longPressTimerRef = useRef(null)
  const longPressStartRef = useRef(null) // { clientX, clientY }

  const [tutorial, setTutorial] = useState(() => {
    if (initial.fromShare) return null
    try { return localStorage.getItem(TUTORIAL_KEY) === 'true' ? null : { step: 0 } }
    catch { return { step: 0 } }
  })

  const importInputRef = useRef(null)
  const skipInitialSaveRef = useRef(true)

  function flash(message) {
    setToast(message)
    window.setTimeout(() => setToast(t => (t === message ? null : t)), 1800)
  }

  function cancelLongPress() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    longPressStartRef.current = null
  }

  // ------------------ undo/redo ------------------
  function snapshotBefore() {
    return {
      nodes: nodesRef.current,
      connections: connectionsRef.current,
      groups: groupsRef.current,
    }
  }
  function applySnapshot(snap) {
    setNodes(snap.nodes)
    setConnections(snap.connections)
    setGroups(snap.groups || [])
  }
  function commit(next, before) {
    undoStack.current.push(before ?? snapshotBefore())
    redoStack.current = []
    applySnapshot({
      nodes: next.nodes,
      connections: next.connections,
      groups: next.groups ?? groupsRef.current,
    })
    forceRender(n => n + 1)
  }
  function undo() {
    if (undoStack.current.length === 0) return
    const prev = undoStack.current.pop()
    redoStack.current.push(snapshotBefore())
    applySnapshot(prev)
    forceRender(n => n + 1)
  }
  function redo() {
    if (redoStack.current.length === 0) return
    const next = redoStack.current.pop()
    undoStack.current.push(snapshotBefore())
    applySnapshot(next)
    forceRender(n => n + 1)
  }

  // ------------------ coords ------------------
  function clientToSvgPoint(clientX, clientY) {
    const svg = svgRef.current
    const rect = svg.getBoundingClientRect()
    const vb = viewBoxRef.current
    return {
      x: vb.x + ((clientX - rect.left) / rect.width) * vb.w,
      y: vb.y + ((clientY - rect.top) / rect.height) * vb.h,
    }
  }
  function isPointOverSvg(clientX, clientY) {
    const svg = svgRef.current
    if (!svg) return false
    const rect = svg.getBoundingClientRect()
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
  }

  // ------------------ palette pointer drag ------------------
  function handlePaletteItemPointerDown(e, item) {
    if (e.button !== undefined && e.button !== 0) return
    e.preventDefault()
    setPaletteDragging({ item, x: e.clientX, y: e.clientY })
    if (isMobile) setPaletteOpen(false)
    window.addEventListener('pointermove', handlePaletteDragMove)
    window.addEventListener('pointerup', handlePaletteDragUp)
    window.addEventListener('pointercancel', handlePaletteDragUp)
  }
  function handlePaletteDragMove(e) {
    setPaletteDragging(d => (d ? { ...d, x: e.clientX, y: e.clientY } : d))
  }
  function handlePaletteDragUp(e) {
    window.removeEventListener('pointermove', handlePaletteDragMove)
    window.removeEventListener('pointerup', handlePaletteDragUp)
    window.removeEventListener('pointercancel', handlePaletteDragUp)
    const dragging = paletteDraggingRef.current
    setPaletteDragging(null)
    if (!dragging) return
    if (!isPointOverSvg(e.clientX, e.clientY)) return
    const { x, y } = clientToSvgPoint(e.clientX, e.clientY)
    const item = dragging.item
    const before = snapshotBefore()
    const newNode = {
      id: nextId(item.type),
      type: item.type,
      label: item.label,
      color: item.color,
      x: snap(x - NODE_W / 2),
      y: snap(y - NODE_H / 2),
    }
    commit({ nodes: [...nodesRef.current, newNode], connections: connectionsRef.current }, before)
    setSelectedIds([newNode.id])
  }

  // ------------------ node move (+multi + alignment + long-press) ------------------
  const movingRef = useRef(null)
  function handleNodePointerDown(e, node) {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return
    e.stopPropagation()
    setContextMenu(null)

    let ids
    if (e.shiftKey) {
      const already = selectedIdsRef.current.includes(node.id)
      ids = already ? selectedIdsRef.current.filter(id => id !== node.id) : [...selectedIdsRef.current, node.id]
    } else if (selectedIdsRef.current.includes(node.id)) {
      ids = selectedIdsRef.current
    } else {
      ids = [node.id]
    }
    setSelectedIds(ids)

    const { x, y } = clientToSvgPoint(e.clientX, e.clientY)
    const movingIds = ids.filter(id => nodesRef.current.some(n => n.id === id))
    const initialPositions = {}
    for (const id of movingIds) {
      const n = nodesRef.current.find(nn => nn.id === id)
      if (n) initialPositions[id] = { x: n.x, y: n.y }
    }
    movingRef.current = {
      primaryId: node.id,
      movingIds,
      initialPositions,
      startX: x, startY: y,
      startClientX: e.clientX, startClientY: e.clientY,
      before: snapshotBefore(),
      moved: false,
      pointerId: e.pointerId,
    }

    // Long-press for touch/pen → context menu
    if (e.pointerType && e.pointerType !== 'mouse') {
      longPressStartRef.current = { x: e.clientX, y: e.clientY }
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = null
        const m = movingRef.current
        if (!m || m.moved) return
        movingRef.current = null
        window.removeEventListener('pointermove', handleNodePointerMove)
        window.removeEventListener('pointerup', handleNodePointerUp)
        window.removeEventListener('pointercancel', handleNodePointerUp)
        setContextMenu({
          x: longPressStartRef.current.x,
          y: longPressStartRef.current.y,
          kind: 'node',
          id: node.id,
        })
      }, LONG_PRESS_MS)
    }

    window.addEventListener('pointermove', handleNodePointerMove)
    window.addEventListener('pointerup', handleNodePointerUp)
    window.addEventListener('pointercancel', handleNodePointerUp)
  }
  function handleNodePointerMove(e) {
    const m = movingRef.current
    if (!m) return
    if (longPressStartRef.current) {
      const d = Math.hypot(e.clientX - longPressStartRef.current.x, e.clientY - longPressStartRef.current.y)
      if (d > LONG_PRESS_MOVE_TOLERANCE) cancelLongPress()
    }
    m.moved = true
    const { x, y } = clientToSvgPoint(e.clientX, e.clientY)
    const dx = x - m.startX
    const dy = y - m.startY
    const primaryStart = m.initialPositions[m.primaryId]
    const primaryProjected = { x: primaryStart.x + dx, y: primaryStart.y + dy }
    const others = nodesRef.current.filter(n => !m.movingIds.includes(n.id))
    const { dx: sdx, dy: sdy, guides } = computeSnap(primaryProjected, others)
    const finalDX = dx + sdx
    const finalDY = dy + sdy
    setNodes(current => current.map(n => (
      m.movingIds.includes(n.id)
        ? { ...n, x: m.initialPositions[n.id].x + finalDX, y: m.initialPositions[n.id].y + finalDY }
        : n
    )))
    setAlignmentGuides(guides)
  }
  function handleNodePointerUp() {
    cancelLongPress()
    const m = movingRef.current
    if (m) {
      if (m.moved) {
        setNodes(current => current.map(n => (
          m.movingIds.includes(n.id) ? { ...n, x: snap(n.x), y: snap(n.y) } : n
        )))
        undoStack.current.push(m.before)
        redoStack.current = []
      }
      forceRender(n => n + 1)
    }
    movingRef.current = null
    setAlignmentGuides([])
    window.removeEventListener('pointermove', handleNodePointerMove)
    window.removeEventListener('pointerup', handleNodePointerUp)
    window.removeEventListener('pointercancel', handleNodePointerUp)
  }

  // ------------------ connect ------------------
  function handleSourceHandlePointerDown(e, node) {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return
    e.stopPropagation()
    e.preventDefault()
    connectingFromRef.current = node.id
    const { x, y } = clientToSvgPoint(e.clientX, e.clientY)
    setGhostLine({ x1: node.x + NODE_W, y1: node.y + NODE_H / 2, x2: x, y2: y, color: node.color })
    window.addEventListener('pointermove', handleConnectPointerMove)
    window.addEventListener('pointerup', handleConnectPointerUp)
    window.addEventListener('pointercancel', handleConnectPointerUp)
  }
  function handleConnectPointerMove(e) {
    const { x, y } = clientToSvgPoint(e.clientX, e.clientY)
    setGhostLine(g => (g ? { ...g, x2: x, y2: y } : g))
  }
  function handleConnectPointerUp(e) {
    window.removeEventListener('pointermove', handleConnectPointerMove)
    window.removeEventListener('pointerup', handleConnectPointerUp)
    window.removeEventListener('pointercancel', handleConnectPointerUp)
    const { x, y } = clientToSvgPoint(e.clientX, e.clientY)
    const fromId = connectingFromRef.current
    connectingFromRef.current = null
    setGhostLine(null)
    if (!fromId) return
    const target = nodesRef.current.find(
      n => n.id !== fromId && x >= n.x && x <= n.x + NODE_W && y >= n.y && y <= n.y + NODE_H
    )
    if (!target) return
    const exists = connectionsRef.current.find(
      c => (c.from === fromId && c.to === target.id) || (c.from === target.id && c.to === fromId)
    )
    if (exists) { flash('Those two are already connected'); return }
    const before = snapshotBefore()
    const newConn = { id: nextId('conn'), from: fromId, to: target.id }
    commit({ nodes: nodesRef.current, connections: [...connectionsRef.current, newConn] }, before)
  }

  // ------------------ delete/duplicate/rename/group ------------------
  function deleteById(id) {
    const isNode = nodesRef.current.some(n => n.id === id)
    const before = snapshotBefore()
    if (isNode) {
      const nextNodes = nodesRef.current.filter(n => n.id !== id)
      const nextConns = connectionsRef.current.filter(c => c.from !== id && c.to !== id)
      const nextGroups = groupsRef.current
        .map(g => ({ ...g, nodeIds: g.nodeIds.filter(nid => nid !== id) }))
        .filter(g => g.nodeIds.length > 0)
      commit({ nodes: nextNodes, connections: nextConns, groups: nextGroups }, before)
    } else {
      commit({ nodes: nodesRef.current, connections: connectionsRef.current.filter(c => c.id !== id) }, before)
    }
  }
  function deleteSelected() {
    if (selectedIds.length === 0) return
    const before = snapshotBefore()
    const nodeIdSet = new Set(selectedIds.filter(id => nodesRef.current.some(n => n.id === id)))
    const connIdSet = new Set(selectedIds.filter(id => connectionsRef.current.some(c => c.id === id)))
    const nextNodes = nodesRef.current.filter(n => !nodeIdSet.has(n.id))
    const nextConns = connectionsRef.current.filter(c => !connIdSet.has(c.id) && !nodeIdSet.has(c.from) && !nodeIdSet.has(c.to))
    const nextGroups = groupsRef.current
      .map(g => ({ ...g, nodeIds: g.nodeIds.filter(nid => !nodeIdSet.has(nid)) }))
      .filter(g => g.nodeIds.length > 0)
    commit({ nodes: nextNodes, connections: nextConns, groups: nextGroups }, before)
    setSelectedIds([])
  }
  function duplicateNode(nodeId) {
    const original = nodesRef.current.find(n => n.id === nodeId)
    if (!original) return
    const before = snapshotBefore()
    const copy = {
      ...original,
      id: nextId(original.type),
      x: snap(original.x + GRID * 2),
      y: snap(original.y + GRID),
    }
    commit({ nodes: [...nodesRef.current, copy], connections: connectionsRef.current }, before)
    setSelectedIds([copy.id])
  }
  function startRename(kind, id) {
    if (kind === 'node') {
      const n = nodesRef.current.find(x => x.id === id)
      if (!n) return
      setRenaming({ kind, id, value: n.label })
    } else {
      const g = groupsRef.current.find(x => x.id === id)
      if (!g) return
      setRenaming({ kind, id, value: g.label })
    }
  }
  function commitRename() {
    if (!renaming) return
    const trimmed = renaming.value.trim() || 'Untitled'
    const before = snapshotBefore()
    if (renaming.kind === 'node') {
      commit({
        nodes: nodesRef.current.map(n => (n.id === renaming.id ? { ...n, label: trimmed } : n)),
        connections: connectionsRef.current,
      }, before)
    } else {
      commit({
        nodes: nodesRef.current,
        connections: connectionsRef.current,
        groups: groupsRef.current.map(g => (g.id === renaming.id ? { ...g, label: trimmed } : g)),
      }, before)
    }
    setRenaming(null)
  }
  function groupSelected() {
    const nodeIds = selectedIds.filter(id => nodesRef.current.some(n => n.id === id))
    if (nodeIds.length < 2) { flash('Select at least two parts first'); return }
    const before = snapshotBefore()
    const newGroup = { id: nextId('group'), label: 'Group', nodeIds }
    commit({ nodes: nodesRef.current, connections: connectionsRef.current, groups: [...groupsRef.current, newGroup] }, before)
  }
  function ungroup(groupId) {
    const before = snapshotBefore()
    commit({
      nodes: nodesRef.current,
      connections: connectionsRef.current,
      groups: groupsRef.current.filter(g => g.id !== groupId),
    }, before)
  }
  function selectGroup(groupId) {
    const g = groupsRef.current.find(gg => gg.id === groupId)
    if (!g) return
    setSelectedIds([...g.nodeIds])
  }

  // ------------------ zoom / pan / pinch / rubber-band ------------------
  function handleWheel(e) {
    e.preventDefault()
    const vb = viewBoxRef.current
    const scale = e.deltaY > 0 ? 1.1 : 0.9
    const { x: cx, y: cy } = clientToSvgPoint(e.clientX, e.clientY)
    const newW = Math.min(2400, Math.max(300, vb.w * scale))
    const newH = Math.min(1500, Math.max(180, vb.h * scale))
    const newX = cx - (cx - vb.x) * (newW / vb.w)
    const newY = cy - (cy - vb.y) * (newH / vb.h)
    setViewBox({ x: newX, y: newY, w: newW, h: newH })
  }

  const panRef = useRef(null)
  function handleCanvasPointerDown(e) {
    if (
      e.target.closest('[data-node]') ||
      e.target.closest('[data-handle]') ||
      e.target.closest('[data-conn]') ||
      e.target.closest('[data-group-label]')
    ) return
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return

    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (activePointersRef.current.size === 2) {
      // Enter pinch/two-finger pan
      const pts = Array.from(activePointersRef.current.values())
      const midClient = mid(pts[0], pts[1])
      const anchorSvg = clientToSvgPoint(midClient.x, midClient.y)
      pinchRef.current = {
        startDist: dist(pts[0], pts[1]),
        startMid: midClient,
        startVb: { ...viewBoxRef.current },
        anchorSvg,
      }
      // Cancel single-pointer gestures
      panRef.current = null
      setRubberBand(null)
      window.addEventListener('pointermove', handleCanvasPointerMove)
      window.addEventListener('pointerup', handleCanvasPointerUp)
      window.addEventListener('pointercancel', handleCanvasPointerUp)
      return
    }

    if (activePointersRef.current.size === 1) {
      setContextMenu(null)
      if (e.shiftKey) {
        const p = clientToSvgPoint(e.clientX, e.clientY)
        setRubberBand({ x0: p.x, y0: p.y, x1: p.x, y1: p.y })
      } else {
        setSelectedIds([])
        panRef.current = { startX: e.clientX, startY: e.clientY, vb: viewBoxRef.current }
      }
      window.addEventListener('pointermove', handleCanvasPointerMove)
      window.addEventListener('pointerup', handleCanvasPointerUp)
      window.addEventListener('pointercancel', handleCanvasPointerUp)
    }
  }
  function handleCanvasPointerMove(e) {
    if (!activePointersRef.current.has(e.pointerId)) return
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (activePointersRef.current.size >= 2 && pinchRef.current) {
      const pts = Array.from(activePointersRef.current.values()).slice(0, 2)
      const newDist = dist(pts[0], pts[1])
      const newMid = mid(pts[0], pts[1])
      const { startDist, startVb, anchorSvg } = pinchRef.current
      const scale = startDist / Math.max(newDist, 1)
      const newW = Math.min(2400, Math.max(300, startVb.w * scale))
      const newH = Math.min(1500, Math.max(180, startVb.h * scale))
      const svg = svgRef.current
      const rect = svg.getBoundingClientRect()
      const relX = (newMid.x - rect.left) / rect.width
      const relY = (newMid.y - rect.top) / rect.height
      const newX = anchorSvg.x - relX * newW
      const newY = anchorSvg.y - relY * newH
      setViewBox({ x: newX, y: newY, w: newW, h: newH })
      return
    }

    if (panRef.current) {
      const svg = svgRef.current
      const rect = svg.getBoundingClientRect()
      const dx = ((e.clientX - panRef.current.startX) / rect.width) * panRef.current.vb.w
      const dy = ((e.clientY - panRef.current.startY) / rect.height) * panRef.current.vb.h
      setViewBox({ ...panRef.current.vb, x: panRef.current.vb.x - dx, y: panRef.current.vb.y - dy })
      return
    }
    if (rubberBandRef.current) {
      const p = clientToSvgPoint(e.clientX, e.clientY)
      setRubberBand(r => (r ? { ...r, x1: p.x, y1: p.y } : r))
    }
  }
  function handleCanvasPointerUp(e) {
    activePointersRef.current.delete(e.pointerId)
    if (activePointersRef.current.size === 0) {
      const r = rubberBandRef.current
      if (r) {
        const minX = Math.min(r.x0, r.x1)
        const minY = Math.min(r.y0, r.y1)
        const maxX = Math.max(r.x0, r.x1)
        const maxY = Math.max(r.y0, r.y1)
        const inside = nodesRef.current
          .filter(n => n.x >= minX && n.y >= minY && n.x + NODE_W <= maxX && n.y + NODE_H <= maxY)
          .map(n => n.id)
        setSelectedIds(inside)
        setRubberBand(null)
      }
      panRef.current = null
      pinchRef.current = null
      window.removeEventListener('pointermove', handleCanvasPointerMove)
      window.removeEventListener('pointerup', handleCanvasPointerUp)
      window.removeEventListener('pointercancel', handleCanvasPointerUp)
    } else if (activePointersRef.current.size === 1) {
      pinchRef.current = null
      const remaining = Array.from(activePointersRef.current.values())[0]
      panRef.current = { startX: remaining.x, startY: remaining.y, vb: viewBoxRef.current }
    }
  }

  function resetZoom() { setViewBox({ x: 0, y: 0, w: 900, h: 560 }) }
  function zoomToFit() {
    if (nodes.length === 0) { resetZoom(); return }
    const padding = 60
    const minX = Math.min(...nodes.map(n => n.x)) - padding
    const minY = Math.min(...nodes.map(n => n.y)) - padding
    const maxX = Math.max(...nodes.map(n => n.x + NODE_W)) + padding
    const maxY = Math.max(...nodes.map(n => n.y + NODE_H)) + padding
    setViewBox({ x: minX, y: minY, w: maxX - minX, h: maxY - minY })
  }

  // ------------------ save/load/export/import/share ------------------
  function saveLayout() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, connections, groups }))
    flash('Saved to this browser')
  }
  function loadLayout() {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) { flash('Nothing saved yet'); return }
    try {
      const parsed = JSON.parse(raw)
      const before = snapshotBefore()
      commit({ nodes: parsed.nodes || [], connections: parsed.connections || [], groups: parsed.groups || [] }, before)
      flash('Loaded last save')
    } catch { flash('That save looks corrupted') }
  }
  function clearCanvas() {
    if (nodesRef.current.length === 0 && connectionsRef.current.length === 0) return
    if (!window.confirm('Clear everything on the canvas? You can Undo afterwards.')) return
    const before = snapshotBefore()
    commit(emptyState(), before)
    setSelectedIds([])
  }
  function exportJson() {
    const data = JSON.stringify({ nodes, connections, groups }, null, 2)
    downloadBlob(new Blob([data], { type: 'application/json' }), 'sparkboard-layout.json')
  }
  function importJson(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        const before = snapshotBefore()
        commit({
          nodes: parsed.nodes || [],
          connections: parsed.connections || [],
          groups: parsed.groups || [],
        }, before)
        flash('Imported')
      } catch { window.alert("Hmm, that file doesn't look like a saved layout.") }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 500)
  }

  function graphBounds() {
    if (nodes.length === 0) return { x: 0, y: 0, w: 900, h: 560 }
    const pad = 40
    const minX = Math.min(...nodes.map(n => n.x)) - pad
    const minY = Math.min(...nodes.map(n => n.y)) - pad
    const maxX = Math.max(...nodes.map(n => n.x + NODE_W)) + pad
    const maxY = Math.max(...nodes.map(n => n.y + NODE_H)) + pad
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
  }

  async function exportImage(format) {
    if (nodes.length === 0) { flash('Nothing to export yet'); return }
    const bounds = graphBounds()
    const clone = svgRef.current.cloneNode(true)
    clone.querySelectorAll('[data-transient]').forEach(el => el.remove())
    clone.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`)
    clone.setAttribute('width', String(bounds.w))
    clone.setAttribute('height', String(bounds.h))
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const bg = clone.querySelector('[data-canvas-bg]')
    if (bg) {
      bg.setAttribute('x', String(bounds.x))
      bg.setAttribute('y', String(bounds.y))
      bg.setAttribute('width', String(bounds.w))
      bg.setAttribute('height', String(bounds.h))
    }
    const solid = clone.querySelector('[data-canvas-solid]')
    if (solid) {
      solid.setAttribute('x', String(bounds.x))
      solid.setAttribute('y', String(bounds.y))
      solid.setAttribute('width', String(bounds.w))
      solid.setAttribute('height', String(bounds.h))
    }
    const svgStr = new XMLSerializer().serializeToString(clone)

    if (format === 'svg') {
      downloadBlob(new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' }), 'sparkboard.svg')
      flash('SVG downloaded')
      return
    }

    const bytes = new TextEncoder().encode(svgStr)
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    const dataUrl = 'data:image/svg+xml;base64,' + btoa(bin)
    const img = new Image()
    await new Promise((res, rej) => {
      img.onload = res
      img.onerror = rej
      img.src = dataUrl
    })
    const scale = 2
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bounds.w * scale)
    canvas.height = Math.round(bounds.h * scale)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = theme.canvas
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(blob => {
      if (blob) { downloadBlob(blob, 'sparkboard.png'); flash('PNG downloaded') }
    }, 'image/png')
  }

  function shareLink() {
    const customPalette = palette.filter(p => p.custom)
    const state = { nodes, connections, groups, customPalette }
    const encoded = encodeState(state)
    const url = `${location.origin}${location.pathname}#s=${encoded}`
    try { history.replaceState(null, '', `#s=${encoded}`) } catch {}
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(
        () => flash('Link copied to clipboard'),
        () => flash('Link is in the address bar — copy it manually')
      )
    } else {
      flash('Link is in the address bar — copy it manually')
    }
  }

  // ------------------ custom parts ------------------
  function addCustomPart(name, color) {
    const newPart = {
      type: `custom-${Date.now().toString(36)}-${Math.floor(Math.random() * 999)}`,
      label: name, color, hint: 'Custom part', custom: true,
    }
    const nextPalette = [...palette, newPart]
    setPalette(nextPalette)
    try { localStorage.setItem(PALETTE_KEY, JSON.stringify(nextPalette.filter(p => p.custom))) } catch {}
    setShowAddPart(false)
    flash(`Added "${name}"`)
  }
  function removeCustomPart(type) {
    const nextPalette = palette.filter(p => p.type !== type)
    setPalette(nextPalette)
    try { localStorage.setItem(PALETTE_KEY, JSON.stringify(nextPalette.filter(p => p.custom))) } catch {}
  }

  // ------------------ autosave ------------------
  useEffect(() => {
    if (skipInitialSaveRef.current) { skipInitialSaveRef.current = false; return }
    const t = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, connections, groups })) } catch {}
    }, 400)
    return () => clearTimeout(t)
  }, [nodes, connections, groups])

  useEffect(() => {
    try { localStorage.setItem(THEME_KEY, themeName) } catch {}
    document.documentElement.setAttribute('data-theme', themeName)
  }, [themeName])

  // ------------------ tutorial auto-advance ------------------
  useEffect(() => {
    if (!tutorial) return
    if (tutorial.step === 1 && nodes.length >= 1) setTutorial({ step: 2 })
    else if (tutorial.step === 2 && nodes.length >= 2) setTutorial({ step: 3 })
    else if (tutorial.step === 3 && connections.length >= 1) setTutorial({ step: 4 })
  }, [nodes.length, connections.length, tutorial])

  function tutorialNext() {
    if (!tutorial) return
    const nextStep = tutorial.step + 1
    if (nextStep > 4) endTutorial()
    else setTutorial({ step: nextStep })
  }
  function endTutorial() {
    setTutorial(null)
    try { localStorage.setItem(TUTORIAL_KEY, 'true') } catch {}
  }
  function restartTutorial() {
    try { localStorage.removeItem(TUTORIAL_KEY) } catch {}
    setTutorial({ step: 0 })
  }

  // ------------------ keyboard ------------------
  useEffect(() => {
    function onKey(e) {
      if (renaming) return
      const tag = (e.target && e.target.tagName) || ''
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      else if ((mod && k === 'y') || (mod && e.shiftKey && k === 'z')) { e.preventDefault(); redo() }
      else if (mod && k === 's') { e.preventDefault(); saveLayout() }
      else if (mod && k === 'a') {
        e.preventDefault()
        setSelectedIds([...nodesRef.current.map(n => n.id), ...connectionsRef.current.map(c => c.id)])
      }
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) { e.preventDefault(); deleteSelected() }
      }
      else if (e.key === 'Escape') { setSelectedIds([]); setContextMenu(null); if (renaming) setRenaming(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, renaming])

  // ------------------ derived ------------------
  function nodeCenter(id, side) {
    const n = nodes.find(nn => nn.id === id)
    if (!n) return { x: 0, y: 0 }
    return side === 'right'
      ? { x: n.x + NODE_W, y: n.y + NODE_H / 2 }
      : { x: n.x, y: n.y + NODE_H / 2 }
  }

  const worldBounds = useMemo(() => {
    if (nodes.length === 0) return { x: viewBox.x, y: viewBox.y, w: viewBox.w, h: viewBox.h }
    const minX = Math.min(...nodes.map(n => n.x), viewBox.x)
    const minY = Math.min(...nodes.map(n => n.y), viewBox.y)
    const maxX = Math.max(...nodes.map(n => n.x + NODE_W), viewBox.x + viewBox.w)
    const maxY = Math.max(...nodes.map(n => n.y + NODE_H), viewBox.y + viewBox.h)
    const pad = 40
    return { x: minX - pad, y: minY - pad, w: (maxX - minX) + pad * 2, h: (maxY - minY) + pad * 2 }
  }, [nodes, viewBox])

  const renameScreenBox = useMemo(() => {
    if (!renaming || renaming.kind !== 'node' || !svgRef.current || !canvasWrapRef.current) return null
    const n = nodes.find(nn => nn.id === renaming.id)
    if (!n) return null
    const rect = svgRef.current.getBoundingClientRect()
    const wrap = canvasWrapRef.current.getBoundingClientRect()
    const x = ((n.x - viewBox.x) / viewBox.w) * rect.width + (rect.left - wrap.left)
    const y = ((n.y - viewBox.y) / viewBox.h) * rect.height + (rect.top - wrap.top)
    const w = (NODE_W / viewBox.w) * rect.width
    const h = (NODE_H / viewBox.h) * rect.height
    return { x, y, w, h }
  }, [renaming, nodes, viewBox])

  const isSelected = id => selectedIds.includes(id)
  const uniqueArrowColors = useMemo(() => {
    const s = new Set()
    for (const c of connections) {
      const t = nodes.find(n => n.id === c.to)
      if (t) s.add(t.color)
    }
    return Array.from(s)
  }, [connections, nodes])
  function colorKey(c) { return c.replace(/[^a-zA-Z0-9]/g, '') }

  const btnStyle = isMobile
    ? { minHeight: 40, padding: '8px 12px', fontSize: 13 }
    : {}

  // ============================================================
  // Render
  // ============================================================
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: theme.bg, color: theme.text, overflow: 'hidden',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 6, padding: isMobile ? '8px 10px' : '10px 14px',
        borderBottom: `1px solid ${theme.border}`, alignItems: 'center',
        background: theme.toolbar, flexWrap: 'wrap',
      }}>
        <strong style={{ marginRight: 8, fontSize: 15 }}>Sparkboard</strong>

        {isMobile && (
          <button style={btnStyle} onClick={() => setPaletteOpen(p => !p)} title="Show parts panel">
            Parts
          </button>
        )}

        <button style={btnStyle} onClick={undo} disabled={undoStack.current.length === 0} title="Undo (Ctrl+Z)">Undo</button>
        <button style={btnStyle} onClick={redo} disabled={redoStack.current.length === 0} title="Redo (Ctrl+Y)">Redo</button>
        <Divider theme={theme} />
        <button style={btnStyle} onClick={deleteSelected} disabled={selectedIds.length === 0} title="Delete selection (Del)">Delete</button>
        <button style={btnStyle} onClick={groupSelected} disabled={selectedIds.filter(id => nodes.some(n => n.id === id)).length < 2} title="Group the selected parts">Group</button>
        <Divider theme={theme} />
        <button style={btnStyle} onClick={() => setViewBox(vb => ({ ...vb, w: vb.w * 0.9, h: vb.h * 0.9 }))} title="Zoom in">+</button>
        <button style={btnStyle} onClick={() => setViewBox(vb => ({ ...vb, w: vb.w * 1.1, h: vb.h * 1.1 }))} title="Zoom out">−</button>
        <button style={btnStyle} onClick={resetZoom} title="Back to default view">Reset</button>
        <button style={btnStyle} onClick={zoomToFit} title="Fit everything on screen">Fit</button>
        <Divider theme={theme} />
        <button style={btnStyle} onClick={saveLayout} title="Save (Ctrl+S)">Save</button>
        <button style={btnStyle} onClick={loadLayout} title="Load last saved">Load</button>
        <button style={btnStyle} onClick={exportJson} title="Download as a JSON file">JSON</button>
        <button style={btnStyle} onClick={() => exportImage('png')} title="Export as an image">PNG</button>
        <button style={btnStyle} onClick={() => exportImage('svg')} title="Export as vector SVG">SVG</button>
        <button style={btnStyle} onClick={() => importInputRef.current?.click()} title="Load from a file">Import</button>
        <input ref={importInputRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={importJson} />
        <button style={btnStyle} onClick={shareLink} title="Copy a shareable link">Share</button>
        <button style={btnStyle} onClick={clearCanvas} title="Remove everything">Clear</button>
        <Divider theme={theme} />
        <button
          style={{ ...btnStyle, ...(simulating ? { background: theme.tutorialBg, color: theme.tutorialFg } : {}) }}
          onClick={() => setSimulating(s => !s)}
          title="Show data flowing along connections"
        >
          {simulating ? 'Pause' : 'Simulate'}
        </button>
        <button
          style={btnStyle}
          onClick={() => setThemeName(n => (n === 'dark' ? 'light' : 'dark'))}
          title="Toggle light / dark theme"
        >
          {themeName === 'dark' ? 'Light' : 'Dark'}
        </button>
        <div style={{ marginLeft: 'auto' }} />
        <button style={btnStyle} onClick={() => setShowHelp(h => !h)} title="Show tips">{showHelp ? 'Hide tips' : 'Tips'}</button>
      </div>

      {/* Help panel */}
      {showHelp && (
        <div style={{
          padding: '10px 16px', background: theme.help.bg,
          borderBottom: `1px solid ${theme.help.border}`, fontSize: 12, color: theme.help.text,
        }}>
          <b>How to use Sparkboard:</b>
          <ul style={{ margin: '6px 0 6px 18px', padding: 0, lineHeight: 1.6 }}>
            <li>Drag a part from the panel on the left onto the empty space. On phones, tap <b>Parts</b> to open the panel.</li>
            <li>To connect two parts, drag from a part's <em>colored right dot</em> onto another part.</li>
            <li>Tap or click to select. Hold Shift and drag to select several.</li>
            <li>Press <kbd>Delete</kbd>, right-click (or long-press on touch) for options, double-click to rename.</li>
            <li>Scroll to zoom, or pinch with two fingers. Drag empty space to pan.</li>
            <li>Everything auto-saves. Use <b>Share</b> to copy a link, or <b>PNG</b> to save an image.</li>
          </ul>
          <button onClick={restartTutorial} style={{ marginTop: 4 }}>Show me the tutorial again</button>
        </div>
      )}

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
        {/* Palette (desktop inline, mobile drawer) */}
        {isMobile && paletteOpen && (
          <div
            style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 22,
            }}
            onClick={() => setPaletteOpen(false)}
          />
        )}
        <div
          style={{
            width: isMobile ? 240 : 200,
            flexShrink: 0,
            borderRight: `1px solid ${theme.border}`,
            background: theme.panel,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            overflowY: 'auto',
            ...(isMobile ? {
              position: 'absolute',
              left: 0, top: 0, bottom: 0,
              transform: paletteOpen ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'transform 200ms ease-out',
              zIndex: 23,
              boxShadow: paletteOpen ? '4px 0 20px rgba(0,0,0,0.14)' : 'none',
            } : {}),
          }}
        >
          <p style={{ fontSize: 11, color: theme.muted, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Parts</p>
          {palette.map(item => (
            <div
              key={item.type}
              onPointerDown={e => handlePaletteItemPointerDown(e, item)}
              style={{
                padding: isMobile ? '12px 12px' : '8px 10px',
                borderRadius: 6,
                border: `1px solid ${theme.border}`,
                background: theme.paletteItem,
                cursor: 'grab',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                position: 'relative',
                userSelect: 'none',
                touchAction: 'none',
                WebkitUserSelect: 'none',
              }}
              title={`Drag ${item.label} onto the canvas`}
            >
              <PaletteIcon type={item.type} label={item.label} color={item.color} size={isMobile ? 22 : 18} />
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: isMobile ? 14 : 13 }}>{item.label}</span>
                <span style={{ fontSize: 11, color: theme.muted }}>{item.hint}</span>
              </div>
              {item.custom && (
                <button
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); removeCustomPart(item.type) }}
                  title="Remove this custom part"
                  style={{
                    padding: '4px 8px', fontSize: 14, background: 'transparent',
                    border: 'none', color: theme.muted, cursor: 'pointer', minHeight: 32,
                  }}
                >×</button>
              )}
            </div>
          ))}
          <button onClick={() => setShowAddPart(true)} style={{ ...btnStyle, marginTop: 6, fontSize: 13 }}>+ New part…</button>
          <p style={{ fontSize: 11, color: theme.subtle, marginTop: 14, lineHeight: 1.5 }}>
            Drag a part onto the canvas to add it. Drag from its colored dot to another part to connect them.
          </p>
        </div>

        {/* Canvas + overlays */}
        <div ref={canvasWrapRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <svg
            ref={svgRef}
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            style={{
              display: 'block', width: '100%', height: '100%',
              background: theme.canvas,
              touchAction: 'none',
              cursor: panRef.current ? 'grabbing' : 'default',
              WebkitUserSelect: 'none',
              userSelect: 'none',
            }}
            onWheel={handleWheel}
            onPointerDown={handleCanvasPointerDown}
          >
            <defs>
              <rect data-canvas-solid x={viewBox.x - viewBox.w} y={viewBox.y - viewBox.h}
                width={viewBox.w * 3} height={viewBox.h * 3} fill={theme.canvas} />
              <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke={theme.grid} strokeWidth={1} />
              </pattern>
              <filter id="nodeShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.18" />
              </filter>
              {uniqueArrowColors.map(c => (
                <marker
                  key={c}
                  id={`arrow-${colorKey(c)}`}
                  viewBox="0 0 10 10"
                  refX="9" refY="5"
                  markerWidth="7" markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={c} />
                </marker>
              ))}
              {connections.map(c => {
                const src = nodes.find(n => n.id === c.from)
                const tgt = nodes.find(n => n.id === c.to)
                if (!src || !tgt) return null
                const p1 = { x: src.x + NODE_W, y: src.y + NODE_H / 2 }
                const p2 = { x: tgt.x, y: tgt.y + NODE_H / 2 }
                return (
                  <linearGradient
                    key={c.id}
                    id={`grad-${c.id}`}
                    x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor={src.color} />
                    <stop offset="100%" stopColor={tgt.color} />
                  </linearGradient>
                )
              })}
            </defs>

            <rect data-canvas-bg
              x={viewBox.x - viewBox.w} y={viewBox.y - viewBox.h}
              width={viewBox.w * 3} height={viewBox.h * 3}
              fill="url(#grid)" pointerEvents="none"
            />

            {/* Groups */}
            {groups.map(g => {
              const members = nodes.filter(n => g.nodeIds.includes(n.id))
              if (members.length === 0) return null
              const pad = 18
              const minX = Math.min(...members.map(n => n.x)) - pad
              const minY = Math.min(...members.map(n => n.y)) - pad - 6
              const maxX = Math.max(...members.map(n => n.x + NODE_W)) + pad
              const maxY = Math.max(...members.map(n => n.y + NODE_H)) + pad
              const labelWidth = Math.max(60, g.label.length * 7 + 16)
              return (
                <g key={g.id}>
                  <rect
                    x={minX} y={minY} width={maxX - minX} height={maxY - minY} rx={12}
                    fill="none" stroke={theme.group} strokeWidth={1.5} strokeDasharray="6 4"
                    pointerEvents="none"
                  />
                  <g
                    data-group-label
                    style={{ cursor: 'pointer' }}
                    onPointerDown={e => {
                      e.stopPropagation()
                      selectGroup(g.id)
                      setContextMenu(null)
                    }}
                    onDoubleClick={e => { e.stopPropagation(); startRename('group', g.id) }}
                    onContextMenu={e => {
                      e.preventDefault(); e.stopPropagation()
                      selectGroup(g.id)
                      setContextMenu({ x: e.clientX, y: e.clientY, kind: 'group', id: g.id })
                    }}
                  >
                    <rect x={minX + 6} y={minY - 10} width={labelWidth} height={22} rx={5} fill={theme.group} />
                    <text
                      x={minX + 6 + labelWidth / 2}
                      y={minY + 5}
                      fontSize={11}
                      fontWeight={600}
                      textAnchor="middle"
                      fill="#fff"
                      style={{ userSelect: 'none' }}
                    >
                      {g.label}
                    </text>
                  </g>
                </g>
              )
            })}

            {/* Connections */}
            {connections.map(c => {
              const src = nodes.find(n => n.id === c.from)
              const tgt = nodes.find(n => n.id === c.to)
              if (!src || !tgt) return null
              const p1 = { x: src.x + NODE_W, y: src.y + NODE_H / 2 }
              const p2 = { x: tgt.x, y: tgt.y + NODE_H / 2 }
              const midX = (p1.x + p2.x) / 2
              const midY = (p1.y + p2.y) / 2
              const d = `M ${p1.x} ${p1.y} C ${midX} ${p1.y}, ${midX} ${p2.y}, ${p2.x} ${p2.y}`
              const selected = isSelected(c.id)
              const hovered = hoveredConnId === c.id
              const strokeVal = selected ? theme.selected : `url(#grad-${c.id})`
              return (
                <g key={c.id} data-conn>
                  <path
                    d={d}
                    stroke="transparent"
                    strokeWidth={isMobile ? 26 : 18}
                    fill="none"
                    style={{ cursor: 'pointer' }}
                    onPointerEnter={() => setHoveredConnId(c.id)}
                    onPointerLeave={() => setHoveredConnId(prev => (prev === c.id ? null : prev))}
                    onPointerDown={e => {
                      e.stopPropagation()
                      if (e.shiftKey) {
                        setSelectedIds(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])
                      } else {
                        setSelectedIds([c.id])
                      }
                      setContextMenu(null)
                    }}
                    onDoubleClick={() => deleteById(c.id)}
                  />
                  <path
                    id={`p-${c.id}`}
                    d={d}
                    stroke={strokeVal}
                    strokeWidth={selected ? 4 : hovered ? 3.5 : 2.5}
                    fill="none"
                    markerEnd={`url(#arrow-${colorKey(tgt.color)})`}
                    style={{ pointerEvents: 'none' }}
                  />
                  {simulating && (
                    <>
                      <circle r={4} fill={src.color} data-transient>
                        <animateMotion dur="2.2s" repeatCount="indefinite" begin="0s">
                          <mpath href={`#p-${c.id}`} />
                        </animateMotion>
                      </circle>
                      <circle r={4} fill={src.color} data-transient>
                        <animateMotion dur="2.2s" repeatCount="indefinite" begin="-1.1s">
                          <mpath href={`#p-${c.id}`} />
                        </animateMotion>
                      </circle>
                    </>
                  )}
                  {(hovered || selected) && (() => {
                    const text = `${src.label} → ${tgt.label}`
                    const w = Math.max(60, text.length * 6.5 + 16)
                    return (
                      <g pointerEvents="none" data-transient>
                        <rect x={midX - w / 2} y={midY - 22} width={w} height={20} rx={4}
                          fill={theme.toastBg} opacity={0.9} />
                        <text x={midX} y={midY - 8} textAnchor="middle" fontSize={11} fill={theme.toastFg}>
                          {text}
                        </text>
                      </g>
                    )
                  })()}
                </g>
              )
            })}

            {/* Ghost line while connecting */}
            {ghostLine && (
              <line
                data-transient
                x1={ghostLine.x1} y1={ghostLine.y1}
                x2={ghostLine.x2} y2={ghostLine.y2}
                stroke={ghostLine.color || '#999'}
                strokeWidth={2}
                strokeDasharray="4 4"
                opacity={0.85}
                pointerEvents="none"
              />
            )}

            {/* Alignment guides */}
            {alignmentGuides.map((g, i) => (
              <line
                key={i}
                data-transient
                stroke={theme.guide}
                strokeWidth={1}
                strokeDasharray="4 4"
                pointerEvents="none"
                {...(g.orient === 'v'
                  ? { x1: g.pos, y1: viewBox.y, x2: g.pos, y2: viewBox.y + viewBox.h }
                  : { x1: viewBox.x, y1: g.pos, x2: viewBox.x + viewBox.w, y2: g.pos })}
              />
            ))}

            {/* Rubber band */}
            {rubberBand && (
              <rect
                data-transient
                x={Math.min(rubberBand.x0, rubberBand.x1)}
                y={Math.min(rubberBand.y0, rubberBand.y1)}
                width={Math.abs(rubberBand.x1 - rubberBand.x0)}
                height={Math.abs(rubberBand.y1 - rubberBand.y0)}
                fill={theme.selected}
                fillOpacity={0.08}
                stroke={theme.selected}
                strokeWidth={1}
                strokeDasharray="4 3"
                pointerEvents="none"
              />
            )}

            {/* Nodes */}
            {nodes.map(n => {
              const selected = isSelected(n.id)
              const isRenaming = renaming?.kind === 'node' && renaming.id === n.id
              const handleHitR = isMobile ? 16 : 12
              const sourceR = isMobile ? 9 : 6.5
              const targetR = isMobile ? 7 : 5
              return (
                <g key={n.id} data-node>
                  <rect
                    x={n.x} y={n.y} width={NODE_W} height={NODE_H} rx={9}
                    fill={theme.nodeBg}
                    stroke={selected ? theme.selected : n.color}
                    strokeWidth={selected ? 3 : 2}
                    filter={selected ? 'url(#nodeShadow)' : undefined}
                    style={{ cursor: 'grab' }}
                    onPointerDown={e => handleNodePointerDown(e, n)}
                    onDoubleClick={e => { e.stopPropagation(); startRename('node', n.id) }}
                    onContextMenu={e => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (!selectedIds.includes(n.id)) setSelectedIds([n.id])
                      setContextMenu({ x: e.clientX, y: e.clientY, kind: 'node', id: n.id })
                    }}
                  />
                  <g transform={`translate(${n.x + 16}, ${n.y + NODE_H / 2})`} pointerEvents="none">
                    <NodeIcon type={n.type} label={n.label} color={n.color} size={20} />
                  </g>
                  {!isRenaming && (
                    <text
                      x={n.x + NODE_W / 2 + 12}
                      y={n.y + NODE_H / 2 + 4}
                      textAnchor="middle"
                      fontSize={12}
                      fill={theme.nodeText}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {n.label}
                    </text>
                  )}
                  {/* Left target handle: visible + invisible larger hit */}
                  <circle
                    data-handle
                    cx={n.x} cy={n.y + NODE_H / 2}
                    r={handleHitR} fill="transparent"
                    style={{ cursor: 'default' }}
                  />
                  <circle
                    cx={n.x} cy={n.y + NODE_H / 2}
                    r={targetR}
                    fill={theme.nodeBg}
                    stroke={n.color}
                    strokeWidth={2}
                    pointerEvents="none"
                  />
                  {/* Right source handle: visible + invisible larger hit that receives pointer down */}
                  <circle
                    data-handle
                    cx={n.x + NODE_W} cy={n.y + NODE_H / 2}
                    r={handleHitR} fill="transparent"
                    style={{ cursor: 'crosshair' }}
                    onPointerDown={e => handleSourceHandlePointerDown(e, n)}
                  >
                    <title>Drag from here to another part to connect them</title>
                  </circle>
                  <circle
                    cx={n.x + NODE_W} cy={n.y + NODE_H / 2}
                    r={sourceR}
                    fill={n.color}
                    stroke={n.color}
                    strokeWidth={2}
                    pointerEvents="none"
                  />
                </g>
              )
            })}
          </svg>

          {/* Empty state */}
          {nodes.length === 0 && !tutorial && (
            <div style={{
              position: 'absolute', top: '38%', left: 0, right: 0,
              textAlign: 'center', color: theme.muted, pointerEvents: 'none', padding: '0 20px',
            }}>
              <div style={{ fontSize: 15, marginBottom: 6 }}>Nothing here yet</div>
              <div style={{ fontSize: 12, color: theme.subtle, lineHeight: 1.5 }}>
                {isMobile
                  ? <>Tap <b>Parts</b>, then drag a part onto this space.</>
                  : <>Drag a part from the left onto this space.<br />Then drag from a part's colored dot to another part to link them.</>}
              </div>
            </div>
          )}

          {/* Rename overlay */}
          {renaming && renaming.kind === 'node' && renameScreenBox && (
            <input
              autoFocus
              value={renaming.value}
              onChange={e => setRenaming(r => ({ ...r, value: e.target.value }))}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commitRename() }
                else if (e.key === 'Escape') { e.preventDefault(); setRenaming(null) }
              }}
              style={{
                position: 'absolute',
                left: renameScreenBox.x + 32,
                top: renameScreenBox.y + Math.max(4, (renameScreenBox.h - 24) / 2),
                width: Math.max(30, renameScreenBox.w - 44),
                height: 24,
                border: `1px solid ${theme.selected}`,
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: 12,
                textAlign: 'center',
                background: theme.nodeBg,
                color: theme.nodeText,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          )}
          {renaming && renaming.kind === 'group' && (
            <div style={{
              position: 'absolute', top: 60, left: 20, zIndex: 20,
              background: theme.panel, padding: 8, borderRadius: 6,
              border: `1px solid ${theme.border}`, display: 'flex', gap: 6,
            }}>
              <input
                autoFocus
                value={renaming.value}
                onChange={e => setRenaming(r => ({ ...r, value: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); commitRename() }
                  else if (e.key === 'Escape') { e.preventDefault(); setRenaming(null) }
                }}
                placeholder="Group name"
                style={{
                  padding: '6px 10px', fontSize: 13,
                  border: `1px solid ${theme.border}`, borderRadius: 4,
                  background: theme.bg, color: theme.text,
                }}
              />
              <button onClick={commitRename} style={{ fontSize: 12 }}>OK</button>
              <button onClick={() => setRenaming(null)} style={{ fontSize: 12 }}>Cancel</button>
            </div>
          )}

          {/* Context menu */}
          {contextMenu && contextMenu.kind === 'node' && (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              theme={theme}
              isMobile={isMobile}
              onClose={() => setContextMenu(null)}
              items={[
                { label: 'Rename', onClick: () => startRename('node', contextMenu.id) },
                { label: 'Duplicate', onClick: () => duplicateNode(contextMenu.id) },
                selectedIds.filter(id => nodes.some(n => n.id === id)).length >= 2
                  ? { label: 'Group selected', onClick: groupSelected }
                  : null,
                { label: 'Delete', onClick: () => deleteById(contextMenu.id), danger: true },
              ].filter(Boolean)}
            />
          )}
          {contextMenu && contextMenu.kind === 'group' && (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              theme={theme}
              isMobile={isMobile}
              onClose={() => setContextMenu(null)}
              items={[
                { label: 'Rename group', onClick: () => startRename('group', contextMenu.id) },
                { label: 'Ungroup', onClick: () => ungroup(contextMenu.id) },
              ]}
            />
          )}

          {/* Minimap (desktop only) */}
          {nodes.length > 0 && !isMobile && (
            <div
              title="Overview"
              style={{
                position: 'absolute', right: 12, bottom: 12,
                width: 180, height: 120,
                background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: 6,
                padding: 4, boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
              }}
            >
              <svg
                viewBox={`${worldBounds.x} ${worldBounds.y} ${worldBounds.w} ${worldBounds.h}`}
                preserveAspectRatio="xMidYMid meet"
                style={{ width: '100%', height: '100%', display: 'block' }}
              >
                <rect
                  x={worldBounds.x} y={worldBounds.y}
                  width={worldBounds.w} height={worldBounds.h}
                  fill={theme.canvas}
                />
                {connections.map(c => {
                  const p1 = nodeCenter(c.from, 'right')
                  const p2 = nodeCenter(c.to, 'left')
                  return (
                    <line
                      key={c.id}
                      x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                      stroke={theme.muted}
                      strokeWidth={Math.max(2, worldBounds.w / 300)}
                    />
                  )
                })}
                {nodes.map(n => (
                  <rect key={n.id}
                    x={n.x} y={n.y}
                    width={NODE_W} height={NODE_H}
                    fill={n.color} opacity={0.75}
                  />
                ))}
                <rect
                  x={viewBox.x} y={viewBox.y}
                  width={viewBox.w} height={viewBox.h}
                  fill="none"
                  stroke={theme.selected}
                  strokeWidth={Math.max(2, worldBounds.w / 200)}
                />
              </svg>
            </div>
          )}

          {/* Toast */}
          {toast && (
            <div style={{
              position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
              background: theme.toastBg, color: theme.toastFg,
              padding: '8px 16px', borderRadius: 20, fontSize: 13,
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)', zIndex: 12,
              maxWidth: 'calc(100% - 32px)', textAlign: 'center',
            }}>
              {toast}
            </div>
          )}

          {/* Tutorial */}
          {tutorial && (
            <TutorialCard
              step={tutorial.step}
              theme={theme}
              onNext={tutorialNext}
              onSkip={endTutorial}
            />
          )}

          {/* Add-part modal */}
          {showAddPart && (
            <AddPartModal
              theme={theme}
              onSubmit={addCustomPart}
              onClose={() => setShowAddPart(false)}
            />
          )}
        </div>
      </div>

      {/* Palette drag ghost (fixed, follows pointer) */}
      {paletteDragging && (
        <div style={{
          position: 'fixed',
          left: paletteDragging.x - 44,
          top: paletteDragging.y - 22,
          pointerEvents: 'none',
          zIndex: 100,
          background: theme.paletteItem,
          border: `2px solid ${paletteDragging.item.color}`,
          borderRadius: 8,
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.24)',
          opacity: 0.94,
        }}>
          <PaletteIcon type={paletteDragging.item.type} label={paletteDragging.item.label} color={paletteDragging.item.color} size={20} />
          <span style={{ fontSize: 13, color: theme.text }}>{paletteDragging.item.label}</span>
        </div>
      )}
    </div>
  )
}

function Divider({ theme }) {
  return <span style={{ width: 1, height: 20, background: theme.border, margin: '0 4px' }} />
}
