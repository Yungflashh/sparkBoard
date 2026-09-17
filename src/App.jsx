import React, { useEffect, useRef, useState } from 'react'

const CIRCLE_R = 32

export default function App() {
  const [circles, setCircles] = useState([])
  const [connections, setConnections] = useState([])
  const [ghostLine, setGhostLine] = useState(null)

  const circlesRef = useRef(circles)
  const connectionsRef = useRef(connections)
  useEffect(() => { circlesRef.current = circles }, [circles])
  useEffect(() => { connectionsRef.current = connections }, [connections])

  const svgRef = useRef(null)
  const idRef = useRef(1)
  const connectingFromRef = useRef(null)
  const movingRef = useRef(null)

  function nextId(prefix) { return `${prefix}-${idRef.current++}` }

  function clientToSvg(clientX, clientY) {
    const rect = svgRef.current.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  // ---- Column → workspace (HTML5 drag-and-drop) ----
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

  // ---- Move a placed circle ----
  function handleCircleMouseDown(e, c) {
    e.stopPropagation()
    const { x, y } = clientToSvg(e.clientX, e.clientY)
    movingRef.current = { id: c.id, offsetX: x - c.x, offsetY: y - c.y }
    window.addEventListener('mousemove', handleCircleMouseMove)
    window.addEventListener('mouseup', handleCircleMouseUp)
  }
  function handleCircleMouseMove(e) {
    const m = movingRef.current
    if (!m) return
    const { x, y } = clientToSvg(e.clientX, e.clientY)
    setCircles(cs =>
      cs.map(c => (c.id === m.id ? { ...c, x: x - m.offsetX, y: y - m.offsetY } : c))
    )
  }
  function handleCircleMouseUp() {
    movingRef.current = null
    window.removeEventListener('mousemove', handleCircleMouseMove)
    window.removeEventListener('mouseup', handleCircleMouseUp)
  }

  // ---- Connect two circles (drag from the small right-side handle) ----
  function handleHandleMouseDown(e, c) {
    e.stopPropagation()
    connectingFromRef.current = c.id
    const { x, y } = clientToSvg(e.clientX, e.clientY)
    setGhostLine({ x1: c.x + CIRCLE_R, y1: c.y, x2: x, y2: y })
    window.addEventListener('mousemove', handleConnectMove)
    window.addEventListener('mouseup', handleConnectUp)
  }
  function handleConnectMove(e) {
    const { x, y } = clientToSvg(e.clientX, e.clientY)
    setGhostLine(g => (g ? { ...g, x2: x, y2: y } : g))
  }
  function handleConnectUp(e) {
    window.removeEventListener('mousemove', handleConnectMove)
    window.removeEventListener('mouseup', handleConnectUp)
    const { x, y } = clientToSvg(e.clientX, e.clientY)
    const fromId = connectingFromRef.current
    connectingFromRef.current = null
    setGhostLine(null)
    if (!fromId) return
    const target = circlesRef.current.find(
      c => c.id !== fromId && Math.hypot(c.x - x, c.y - y) <= CIRCLE_R
    )
    if (!target) return
    const duplicate = connectionsRef.current.find(
      cn =>
        (cn.from === fromId && cn.to === target.id) ||
        (cn.from === target.id && cn.to === fromId)
    )
    if (duplicate) return
    setConnections(cs => [...cs, { id: nextId('conn'), from: fromId, to: target.id }])
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
          Drag the circle from the column onto the workspace, then drag from a placed circle's right dot to another to connect them.
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
            Drag this onto the workspace to add a circle. Repeat for a second one, then link them.
          </p>
        </aside>
        <svg
          ref={svgRef}
          style={{ flex: 1, background: '#f7f6f2', display: 'block' }}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
        >
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
                stroke="#378ADD"
                strokeWidth={2.5}
                style={{ cursor: 'pointer' }}
                onClick={() => deleteConnection(conn.id)}
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
          {circles.map(c => (
            <g key={c.id}>
              <circle
                cx={c.x}
                cy={c.y}
                r={CIRCLE_R}
                fill="#378ADD"
                stroke="#1f6ab8"
                strokeWidth={2}
                style={{ cursor: 'grab' }}
                onMouseDown={e => handleCircleMouseDown(e, c)}
                onContextMenu={e => {
                  e.preventDefault()
                  deleteCircle(c.id)
                }}
              />
              <circle
                cx={c.x + CIRCLE_R}
                cy={c.y}
                r={6}
                fill="#fff"
                stroke="#1f6ab8"
                strokeWidth={2}
                style={{ cursor: 'crosshair' }}
                onMouseDown={e => handleHandleMouseDown(e, c)}
              >
                <title>Drag from here to another circle to connect them</title>
              </circle>
            </g>
          ))}
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
