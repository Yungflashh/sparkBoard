import React, { useRef, useState } from 'react'

const CIRCLE_R = 34
const CLICK_MOVE_THRESHOLD = 4

export default function App() {
  const [circles, setCircles] = useState([])
  const [connections, setConnections] = useState([])
  const [selectedForConnect, setSelectedForConnect] = useState(null)

  const svgRef = useRef(null)
  const idRef = useRef(1)
  const movingRef = useRef(null)

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

  // ---- Circle mouse handling: click = connect, drag = move ----
  function handleCircleMouseDown(e, c) {
    e.stopPropagation()
    const { x, y } = clientToSvg(e.clientX, e.clientY)
    movingRef.current = {
      id: c.id,
      offsetX: x - c.x,
      offsetY: y - c.y,
      startClientX: e.clientX,
      startClientY: e.clientY,
      moved: false,
    }
    window.addEventListener('mousemove', handleCircleMouseMove)
    window.addEventListener('mouseup', handleCircleMouseUp)
  }
  function handleCircleMouseMove(e) {
    const m = movingRef.current
    if (!m) return
    if (!m.moved) {
      const d = Math.hypot(e.clientX - m.startClientX, e.clientY - m.startClientY)
      if (d < CLICK_MOVE_THRESHOLD) return
      m.moved = true
    }
    const { x, y } = clientToSvg(e.clientX, e.clientY)
    setCircles(cs =>
      cs.map(c => (c.id === m.id ? { ...c, x: x - m.offsetX, y: y - m.offsetY } : c))
    )
  }
  function handleCircleMouseUp() {
    const m = movingRef.current
    window.removeEventListener('mousemove', handleCircleMouseMove)
    window.removeEventListener('mouseup', handleCircleMouseUp)
    if (m && !m.moved) toggleConnect(m.id)
    movingRef.current = null
  }

  function toggleConnect(circleId) {
    setSelectedForConnect(current => {
      if (current === null) return circleId
      if (current === circleId) return null
      setConnections(cs => {
        const dup = cs.find(
          cn =>
            (cn.from === current && cn.to === circleId) ||
            (cn.from === circleId && cn.to === current)
        )
        if (dup) return cs
        return [...cs, { id: nextId('conn'), from: current, to: circleId }]
      })
      return null
    })
  }

  // Clicking empty canvas cancels a pending selection
  function handleCanvasMouseDown() {
    setSelectedForConnect(null)
  }

  function deleteConnection(id) {
    setConnections(cs => cs.filter(c => c.id !== id))
  }
  function deleteCircle(id) {
    setCircles(cs => cs.filter(c => c.id !== id))
    setConnections(cs => cs.filter(c => c.from !== id && c.to !== id))
    setSelectedForConnect(s => (s === id ? null : s))
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
          Drag circles from the column onto the workspace, then click one circle and click another to connect them.
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
            Drag onto the workspace to add a circle. Do it twice, then click both to link them.
          </p>
        </aside>
        <svg
          ref={svgRef}
          style={{ flex: 1, background: '#f7f6f2', display: 'block' }}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
          onMouseDown={handleCanvasMouseDown}
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
                onClick={e => {
                  e.stopPropagation()
                  deleteConnection(conn.id)
                }}
              />
            )
          })}
          {circles.map(c => {
            const selected = selectedForConnect === c.id
            return (
              <circle
                key={c.id}
                cx={c.x}
                cy={c.y}
                r={CIRCLE_R}
                fill="#378ADD"
                stroke={selected ? '#f4a300' : '#1f6ab8'}
                strokeWidth={selected ? 4 : 2}
                style={{ cursor: 'pointer' }}
                onMouseDown={e => handleCircleMouseDown(e, c)}
                onContextMenu={e => {
                  e.preventDefault()
                  deleteCircle(c.id)
                }}
              />
            )
          })}
          {selectedForConnect && (
            <text
              x="50%"
              y={22}
              textAnchor="middle"
              fontSize={13}
              fill="#c47a00"
              fontWeight={600}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              Now click another circle to connect
            </text>
          )}
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
