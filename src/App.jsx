import React, { useEffect, useRef, useState } from 'react'

const CIRCLE_R = 34
const DOT_R = 5
const HIT_SLOP = 6 // extra grab radius when releasing on a dot

export default function App() {
  const [circles, setCircles] = useState([])
  const [connections, setConnections] = useState([])
  const [ghostLine, setGhostLine] = useState(null) // { fromId, x1, y1, x2, y2 }

  const circlesRef = useRef(circles)
  const connectionsRef = useRef(connections)
  const ghostLineRef = useRef(ghostLine)
  useEffect(() => { circlesRef.current = circles }, [circles])
  useEffect(() => { connectionsRef.current = connections }, [connections])
  useEffect(() => { ghostLineRef.current = ghostLine }, [ghostLine])

  const svgRef = useRef(null)
  const idRef = useRef(1)

  function nextId(prefix) { return `${prefix}-${idRef.current++}` }

  function clientToSvg(clientX, clientY) {
    const rect = svgRef.current.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  // ---- Column → workspace via HTML5 drag-and-drop ----
  function handleColumnDragStart(e) {
    e.dataTransfer.setData('text/plain', 'circle')
    e.dataTransfer.effectAllowed = 'copy'
  }
  function handleCanvasDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }
  function handleCanvasDrop(e) {
    e.preventDefault()
    if (e.dataTransfer.getData('text/plain') !== 'circle') return
    const { x, y } = clientToSvg(e.clientX, e.clientY)
    setCircles(cs => [...cs, { id: nextId('c'), x, y }])
  }

  // ---- Manually draw a line: drag from one dot to another dot ----
  function handleDotMouseDown(e, c) {
    e.stopPropagation()
    e.preventDefault()
    const { x, y } = clientToSvg(e.clientX, e.clientY)
    setGhostLine({ fromId: c.id, x1: c.x, y1: c.y, x2: x, y2: y })
    window.addEventListener('mousemove', handleDrawMove)
    window.addEventListener('mouseup', handleDrawUp)
  }
  function handleDrawMove(e) {
    const { x, y } = clientToSvg(e.clientX, e.clientY)
    setGhostLine(g => (g ? { ...g, x2: x, y2: y } : g))
  }
  function handleDrawUp(e) {
    window.removeEventListener('mousemove', handleDrawMove)
    window.removeEventListener('mouseup', handleDrawUp)
    const g = ghostLineRef.current
    setGhostLine(null)
    if (!g) return
    const { x, y } = clientToSvg(e.clientX, e.clientY)

    // Release must land on another circle's dot (the dot is at the center)
    const target = circlesRef.current.find(
      c => c.id !== g.fromId && Math.hypot(c.x - x, c.y - y) <= DOT_R + HIT_SLOP
    )
    if (!target) return

    const dup = connectionsRef.current.find(
      cn =>
        (cn.from === g.fromId && cn.to === target.id) ||
        (cn.from === target.id && cn.to === g.fromId)
    )
    if (dup) return

    setConnections(cs => [...cs, { id: nextId('conn'), from: g.fromId, to: target.id }])
  }

  function deleteConnection(id) {
    setConnections(cs => cs.filter(c => c.id !== id))
  }
  function deleteCircle(id) {
    setCircles(cs => cs.filter(c => c.id !== id))
    setConnections(cs => cs.filter(c => c.from !== id && c.to !== id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #e0dfd9',
          background: '#fff',
          display: 'flex',
          alignItems: 'baseline',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <strong style={{ fontSize: 15 }}>Drag &amp; Connect Circles</strong>
        <span style={{ fontSize: 12, color: '#666' }}>
          Drag circles from the column onto the workspace. Then drag from the dot on one circle to the dot on another to draw a line.
        </span>
      </header>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <aside
          style={{
            width: 140,
            borderRight: '1px solid #e0dfd9',
            background: '#fff',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <p
            style={{
              fontSize: 11,
              color: '#888',
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Column
          </p>
          <div
            draggable
            onDragStart={handleColumnDragStart}
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: '#378ADD',
              border: '2px solid #1f6ab8',
              cursor: 'grab',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              userSelect: 'none',
            }}
            title="Drag me onto the workspace"
          >
            Circle
          </div>
          <p
            style={{
              fontSize: 11,
              color: '#aaa',
              margin: '10px 0 0',
              lineHeight: 1.4,
              textAlign: 'center',
            }}
          >
            Drag onto the workspace to add a circle. Do it twice, then drag from the dot on one circle to the dot on the other.
          </p>
        </aside>
        <svg
          ref={svgRef}
          style={{ flex: 1, background: '#f7f6f2', display: 'block' }}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
        >
          {/* Pass 1: circle bodies (behind lines) */}
          {circles.map(c => (
            <circle
              key={`body-${c.id}`}
              cx={c.x}
              cy={c.y}
              r={CIRCLE_R}
              fill="#378ADD"
              stroke="#1f6ab8"
              strokeWidth={2}
              onContextMenu={e => {
                e.preventDefault()
                deleteCircle(c.id)
              }}
            />
          ))}

          {/* Pass 2: connections — drawn on top of circles so the line visibly runs dot-to-dot */}
          {connections.map(conn => {
            const from = circles.find(c => c.id === conn.from)
            const to = circles.find(c => c.id === conn.to)
            if (!from || !to) return null
            return (
              <line
                key={conn.id}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="#0d3b6b"
                strokeWidth={2.5}
                style={{ cursor: 'pointer' }}
                onClick={e => {
                  e.stopPropagation()
                  deleteConnection(conn.id)
                }}
              />
            )
          })}

          {/* Ghost line while manually drawing */}
          {ghostLine && (
            <line
              x1={ghostLine.x1}
              y1={ghostLine.y1}
              x2={ghostLine.x2}
              y2={ghostLine.y2}
              stroke="#f4a300"
              strokeWidth={3}
              strokeDasharray="6 4"
              pointerEvents="none"
            />
          )}

          {/* Pass 3: dots — always on top, so line endpoints visibly land on them */}
          {circles.map(c => {
            const isSource = ghostLine?.fromId === c.id
            return (
              <circle
                key={`dot-${c.id}`}
                cx={c.x}
                cy={c.y}
                r={DOT_R}
                fill={isSource ? '#f4a300' : '#0d3b6b'}
                stroke="#fff"
                strokeWidth={1.5}
                style={{ cursor: 'crosshair' }}
                onMouseDown={e => handleDotMouseDown(e, c)}
              />
            )
          })}

          {circles.length === 0 && (
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              fontSize={14}
              fill="#aaa"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              Drag a circle here from the column to begin
            </text>
          )}
        </svg>
      </div>
    </div>
  )
}
