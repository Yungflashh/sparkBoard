import React, { useCallback, useEffect, useRef, useState } from 'react'

const PALETTE = [
  { type: 'motor', label: 'Motor', color: '#378ADD' },
  { type: 'sensor', label: 'Sensor', color: '#1D9E75' },
  { type: 'wheel', label: 'Wheel', color: '#D85A30' },
  { type: 'arm', label: 'Arm', color: '#D4537E' },
  { type: 'battery', label: 'Battery', color: '#BA7517' },
  { type: 'controller', label: 'Controller', color: '#534AB7' },
]

const NODE_W = 96
const NODE_H = 40
const STORAGE_KEY = 'dot-connector-layout'

let idCounter = 1
function nextId(prefix) {
  return `${prefix}-${idCounter++}`
}

function emptyState() {
  return { nodes: [], connections: [] }
}

export default function App() {
  // committed state
  const [nodes, setNodes] = useState([])
  const [connections, setConnections] = useState([])

  // undo/redo stacks (store full snapshots)
  const undoStack = useRef([])
  const redoStack = useRef([])
  const [, forceRender] = useState(0)

  // keep refs in sync for use inside window-level event listeners
  const nodesRef = useRef(nodes)
  const connectionsRef = useRef(connections)
  useEffect(() => { nodesRef.current = nodes }, [nodes])
  useEffect(() => { connectionsRef.current = connections }, [connections])

  const svgRef = useRef(null)
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 900, h: 560 })
  const viewBoxRef = useRef(viewBox)
  useEffect(() => { viewBoxRef.current = viewBox }, [viewBox])

  const [connectingFrom, setConnectingFrom] = useState(null)
  const [ghostLine, setGhostLine] = useState(null)

  // ---------- undo/redo plumbing ----------
  function snapshotBefore() {
    return { nodes: nodesRef.current, connections: connectionsRef.current }
  }
  function commit(next, before) {
    undoStack.current.push(before ?? snapshotBefore())
    redoStack.current = []
    setNodes(next.nodes)
    setConnections(next.connections)
    forceRender(n => n + 1)
  }
  function undo() {
    if (undoStack.current.length === 0) return
    const prev = undoStack.current.pop()
    redoStack.current.push(snapshotBefore())
    setNodes(prev.nodes)
    setConnections(prev.connections)
    forceRender(n => n + 1)
  }
  function redo() {
    if (redoStack.current.length === 0) return
    const next = redoStack.current.pop()
    undoStack.current.push(snapshotBefore())
    setNodes(next.nodes)
    setConnections(next.connections)
    forceRender(n => n + 1)
  }

  // ---------- coordinate helpers ----------
  function clientToSvgPoint(clientX, clientY) {
    const svg = svgRef.current
    const rect = svg.getBoundingClientRect()
    const vb = viewBoxRef.current
    const x = vb.x + ((clientX - rect.left) / rect.width) * vb.w
    const y = vb.y + ((clientY - rect.top) / rect.height) * vb.h
    return { x, y }
  }

  // ---------- palette drag -> drop on canvas ----------
  function handlePaletteDragStart(e, type) {
    e.dataTransfer.setData('text/plain', type)
  }
  function handleCanvasDragOver(e) {
    e.preventDefault()
  }
  function handleCanvasDrop(e) {
    e.preventDefault()
    const type = e.dataTransfer.getData('text/plain')
    const item = PALETTE.find(p => p.type === type)
    if (!item) return
    const { x, y } = clientToSvgPoint(e.clientX, e.clientY)
    const before = snapshotBefore()
    const newNode = {
      id: nextId(type),
      type: item.type,
      label: item.label,
      color: item.color,
      x: x - NODE_W / 2,
      y: y - NODE_H / 2,
    }
    commit({ nodes: [...nodesRef.current, newNode], connections: connectionsRef.current }, before)
  }

  // ---------- moving a node ----------
  const movingRef = useRef(null) // { id, offsetX, offsetY, before }
  function handleNodeMouseDown(e, node) {
    e.stopPropagation()
    const { x, y } = clientToSvgPoint(e.clientX, e.clientY)
    movingRef.current = {
      id: node.id,
      offsetX: x - node.x,
      offsetY: y - node.y,
      before: snapshotBefore(),
    }
    window.addEventListener('mousemove', handleNodeMouseMove)
    window.addEventListener('mouseup', handleNodeMouseUp)
  }
  function handleNodeMouseMove(e) {
    const m = movingRef.current
    if (!m) return
    const { x, y } = clientToSvgPoint(e.clientX, e.clientY)
    setNodes(current =>
      current.map(n => (n.id === m.id ? { ...n, x: x - m.offsetX, y: y - m.offsetY } : n))
    )
  }
  function handleNodeMouseUp() {
    const m = movingRef.current
    if (m) {
      undoStack.current.push(m.before)
      redoStack.current = []
      forceRender(n => n + 1)
    }
    movingRef.current = null
    window.removeEventListener('mousemove', handleNodeMouseMove)
    window.removeEventListener('mouseup', handleNodeMouseUp)
  }

  // ---------- connecting two nodes via handles ----------
  function handleSourceHandleMouseDown(e, node) {
    e.stopPropagation()
    setConnectingFrom(node.id)
    const { x, y } = clientToSvgPoint(e.clientX, e.clientY)
    setGhostLine({ x1: node.x + NODE_W, y1: node.y + NODE_H / 2, x2: x, y2: y })
    window.addEventListener('mousemove', handleConnectMouseMove)
    window.addEventListener('mouseup', handleConnectMouseUp)
  }
  function handleConnectMouseMove(e) {
    const { x, y } = clientToSvgPoint(e.clientX, e.clientY)
    setGhostLine(g => (g ? { ...g, x2: x, y2: y } : g))
  }
  function handleConnectMouseUp(e) {
    window.removeEventListener('mousemove', handleConnectMouseMove)
    window.removeEventListener('mouseup', handleConnectMouseUp)
    const { x, y } = clientToSvgPoint(e.clientX, e.clientY)
    const fromId = connectingFrom
    setConnectingFrom(null)
    setGhostLine(null)
    if (!fromId) return
    const target = nodesRef.current.find(
      n => n.id !== fromId && x >= n.x && x <= n.x + NODE_W && y >= n.y && y <= n.y + NODE_H
    )
    if (!target) return
    const exists = connectionsRef.current.find(c => c.from === fromId && c.to === target.id)
    if (exists) return
    const before = snapshotBefore()
    const newConn = { id: nextId('conn'), from: fromId, to: target.id }
    commit({ nodes: nodesRef.current, connections: [...connectionsRef.current, newConn] }, before)
  }

  function deleteConnection(connId) {
    const before = snapshotBefore()
    commit(
      { nodes: nodesRef.current, connections: connectionsRef.current.filter(c => c.id !== connId) },
      before
    )
  }

  function deleteNode(nodeId) {
    const before = snapshotBefore()
    commit(
      {
        nodes: nodesRef.current.filter(n => n.id !== nodeId),
        connections: connectionsRef.current.filter(c => c.from !== nodeId && c.to !== nodeId),
      },
      before
    )
  }

  // ---------- zoom / pan ----------
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
  function handleCanvasMouseDown(e) {
    if (e.target.closest('[data-node]') || e.target.closest('[data-handle]')) return
    panRef.current = { startX: e.clientX, startY: e.clientY, vb: viewBoxRef.current }
    window.addEventListener('mousemove', handlePanMove)
    window.addEventListener('mouseup', handlePanUp)
  }
  function handlePanMove(e) {
    const p = panRef.current
    if (!p) return
    const svg = svgRef.current
    const rect = svg.getBoundingClientRect()
    const dx = ((e.clientX - p.startX) / rect.width) * p.vb.w
    const dy = ((e.clientY - p.startY) / rect.height) * p.vb.h
    setViewBox({ ...p.vb, x: p.vb.x - dx, y: p.vb.y - dy })
  }
  function handlePanUp() {
    panRef.current = null
    window.removeEventListener('mousemove', handlePanMove)
    window.removeEventListener('mouseup', handlePanUp)
  }

  function resetZoom() {
    setViewBox({ x: 0, y: 0, w: 900, h: 560 })
  }

  // ---------- save / load ----------
  function saveLayout() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, connections }))
  }
  function loadLayout() {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      const before = snapshotBefore()
      commit({ nodes: parsed.nodes || [], connections: parsed.connections || [] }, before)
    } catch {
      // ignore corrupt data
    }
  }
  function clearCanvas() {
    const before = snapshotBefore()
    commit(emptyState(), before)
  }

  function nodeCenter(id, side) {
    const n = nodes.find(n => n.id === id)
    if (!n) return { x: 0, y: 0 }
    return side === 'right'
      ? { x: n.x + NODE_W, y: n.y + NODE_H / 2 }
      : { x: n.x, y: n.y + NODE_H / 2 }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '10px 14px',
          borderBottom: '1px solid #ddd',
          alignItems: 'center',
          background: '#fff',
        }}
      >
        <strong style={{ marginRight: 12, fontSize: 14 }}>Dot Connector</strong>
        <button onClick={undo} disabled={undoStack.current.length === 0}>Undo</button>
        <button onClick={redo} disabled={redoStack.current.length === 0}>Redo</button>
        <span style={{ width: 1, height: 20, background: '#ddd', margin: '0 4px' }} />
        <button onClick={() => setViewBox(vb => ({ ...vb, w: vb.w * 0.9, h: vb.h * 0.9 }))}>Zoom in</button>
        <button onClick={() => setViewBox(vb => ({ ...vb, w: vb.w * 1.1, h: vb.h * 1.1 }))}>Zoom out</button>
        <button onClick={resetZoom}>Reset view</button>
        <span style={{ width: 1, height: 20, background: '#ddd', margin: '0 4px' }} />
        <button onClick={saveLayout}>Save</button>
        <button onClick={loadLayout}>Load</button>
        <button onClick={clearCanvas}>Clear</button>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div
          style={{
            width: 140,
            flexShrink: 0,
            borderRight: '1px solid #ddd',
            background: '#fff',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            overflowY: 'auto',
          }}
        >
          <p style={{ fontSize: 12, color: '#888', margin: '0 0 4px' }}>Components</p>
          {PALETTE.map(item => (
            <div
              key={item.type}
              draggable
              onDragStart={e => handlePaletteDragStart(e, item.type)}
              style={{
                padding: '8px 10px',
                fontSize: 13,
                borderRadius: 6,
                border: '1px solid #ddd',
                background: '#faf9f6',
                cursor: 'grab',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: item.color,
                  flexShrink: 0,
                }}
              />
              {item.label}
            </div>
          ))}
          <p style={{ fontSize: 11, color: '#aaa', marginTop: 12, lineHeight: 1.5 }}>
            Drag a component onto the canvas. Drag from a node's right dot to another node's body to connect them.
            Click a connection line to remove it. Right-click a node to delete it.
          </p>
        </div>

        <svg
          ref={svgRef}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          style={{ flex: 1, background: '#f7f6f2', cursor: panRef.current ? 'grabbing' : 'default' }}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
          onWheel={handleWheel}
          onMouseDown={handleCanvasMouseDown}
        >
          {connections.map(c => {
            const p1 = nodeCenter(c.from, 'right')
            const p2 = nodeCenter(c.to, 'left')
            const midX = (p1.x + p2.x) / 2
            return (
              <path
                key={c.id}
                d={`M ${p1.x} ${p1.y} C ${midX} ${p1.y}, ${midX} ${p2.y}, ${p2.x} ${p2.y}`}
                stroke="#378ADD"
                strokeWidth={2.5}
                fill="none"
                style={{ cursor: 'pointer' }}
                onClick={() => deleteConnection(c.id)}
              />
            )
          })}

          {ghostLine && (
            <line
              x1={ghostLine.x1}
              y1={ghostLine.y1}
              x2={ghostLine.x2}
              y2={ghostLine.y2}
              stroke="#999"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
          )}

          {nodes.map(n => (
            <g key={n.id} data-node>
              <rect
                x={n.x}
                y={n.y}
                width={NODE_W}
                height={NODE_H}
                rx={8}
                fill="#fff"
                stroke={n.color}
                strokeWidth={2}
                style={{ cursor: 'grab' }}
                onMouseDown={e => handleNodeMouseDown(e, n)}
                onContextMenu={e => {
                  e.preventDefault()
                  deleteNode(n.id)
                }}
              />
              <text
                x={n.x + NODE_W / 2}
                y={n.y + NODE_H / 2 + 4}
                textAnchor="middle"
                fontSize={12}
                fill="#333"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {n.label}
              </text>
              <circle
                data-handle
                cx={n.x}
                cy={n.y + NODE_H / 2}
                r={5}
                fill="#fff"
                stroke={n.color}
                strokeWidth={2}
              />
              <circle
                data-handle
                cx={n.x + NODE_W}
                cy={n.y + NODE_H / 2}
                r={5}
                fill={n.color}
                stroke={n.color}
                strokeWidth={2}
                style={{ cursor: 'crosshair' }}
                onMouseDown={e => handleSourceHandleMouseDown(e, n)}
              />
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}
