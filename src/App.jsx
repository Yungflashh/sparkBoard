import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  MOTION_BLOCKS,
  CONTROL_BLOCKS,
  PARAM_RANGES,
  DIRECTIONS,
  paramsForMotion,
} from './blocks.js'
import PreviewModal from './PreviewModal.jsx'

const uid = (() => { let n = 1; return (p) => `${p}-${n++}` })()

const emptyProgram = () => ({
  robots: [
    { id: 'robot-1', name: 'Robot 1' },
    { id: 'robot-2', name: 'Robot 2' },
  ],
  divisions: [],
})

const LS_KEY = 'robokido-ide:v1'

function loadProgram() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return emptyProgram()
    const p = JSON.parse(raw)
    return p && p.divisions ? p : emptyProgram()
  } catch { return emptyProgram() }
}

export default function App() {
  const [program, setProgram] = useState(loadProgram)
  const [activeDivisionId, setActiveDivisionId] = useState(null)
  const [activeSubdivisionId, setActiveSubdivisionId] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [locked, setLocked] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showIDE, setShowIDE] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [mobilePalette, setMobilePalette] = useState(false)
  const [mobileDebug, setMobileDebug] = useState(false)
  const [debugLog, setDebugLog] = useState([
    { t: Date.now(), kind: 'info', msg: 'Robokido IDE ready.' },
  ])
  const [running, setRunning] = useState(false)

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(program)) } catch {}
  }, [program])

  const activeDivision = program.divisions.find(d => d.id === activeDivisionId) || null
  const activeSubdivision = activeDivision?.subdivisions.find(s => s.id === activeSubdivisionId) || null

  function log(msg, kind = 'info') {
    setDebugLog(l => [...l.slice(-199), { t: Date.now(), kind, msg }])
  }

  function addDivision() {
    const id = uid('div')
    const robotId = program.robots[0]?.id || null
    const sub = { id: uid('sub'), name: 'Sub 1', blocks: [] }
    setProgram(p => ({
      ...p,
      divisions: [
        ...p.divisions,
        {
          id, name: `Division ${p.divisions.length + 1}`, robotId,
          subdivisions: [sub],
          sequence: [sub.id],
        },
      ],
    }))
    setActiveDivisionId(id)
    setActiveSubdivisionId(sub.id)
    log(`Added ${`Division ${program.divisions.length + 1}`}`)
  }

  function updateDivision(id, patch) {
    setProgram(p => ({
      ...p,
      divisions: p.divisions.map(d => (d.id === id ? { ...d, ...patch } : d)),
    }))
  }

  function removeDivision(id) {
    setProgram(p => ({ ...p, divisions: p.divisions.filter(d => d.id !== id) }))
    if (activeDivisionId === id) { setActiveDivisionId(null); setActiveSubdivisionId(null) }
    log('Division removed', 'warn')
  }

  function addSubdivision(divisionId) {
    const sub = { id: uid('sub'), name: '', blocks: [] }
    setProgram(p => ({
      ...p,
      divisions: p.divisions.map(d => {
        if (d.id !== divisionId) return d
        sub.name = `Sub ${d.subdivisions.length + 1}`
        return { ...d, subdivisions: [...d.subdivisions, sub] }
      }),
    }))
    setActiveSubdivisionId(sub.id)
  }

  function updateSubdivision(divisionId, subId, patch) {
    setProgram(p => ({
      ...p,
      divisions: p.divisions.map(d => d.id !== divisionId ? d : {
        ...d,
        subdivisions: d.subdivisions.map(s => s.id !== subId ? s : { ...s, ...patch }),
      }),
    }))
  }

  function removeSubdivision(divisionId, subId) {
    setProgram(p => ({
      ...p,
      divisions: p.divisions.map(d => d.id !== divisionId ? d : {
        ...d,
        subdivisions: d.subdivisions.filter(s => s.id !== subId),
        sequence: d.sequence.filter(x => x !== subId),
      }),
    }))
    if (activeSubdivisionId === subId) setActiveSubdivisionId(null)
  }

  function appendToSequence(divisionId, subId) {
    setProgram(p => ({
      ...p,
      divisions: p.divisions.map(d => d.id !== divisionId ? d : {
        ...d, sequence: [...d.sequence, subId],
      }),
    }))
  }

  function removeFromSequence(divisionId, index) {
    setProgram(p => ({
      ...p,
      divisions: p.divisions.map(d => d.id !== divisionId ? d : {
        ...d, sequence: d.sequence.filter((_, i) => i !== index),
      }),
    }))
  }

  // Add a block (motion or control) into the currently-active subdivision.
  function addBlockToActive(block) {
    if (!activeDivision || !activeSubdivision) {
      log('Pick a subdivision first.', 'warn')
      return
    }
    const newBlock = cloneBlockDef(block)
    updateSubdivision(activeDivision.id, activeSubdivision.id, {
      blocks: [...activeSubdivision.blocks, newBlock],
    })
  }

  function updateBlock(path, patch) {
    // path = { divisionId, subId, indexes: [i, j, ...] } (nested through control containers)
    setProgram(p => ({
      ...p,
      divisions: p.divisions.map(d => d.id !== path.divisionId ? d : {
        ...d,
        subdivisions: d.subdivisions.map(s => s.id !== path.subId ? s : {
          ...s,
          blocks: mutateAtPath(s.blocks, path.indexes, b => ({ ...b, ...patch })),
        }),
      }),
    }))
  }

  function removeBlock(path) {
    setProgram(p => ({
      ...p,
      divisions: p.divisions.map(d => d.id !== path.divisionId ? d : {
        ...d,
        subdivisions: d.subdivisions.map(s => s.id !== path.subId ? s : {
          ...s,
          blocks: removeAtPath(s.blocks, path.indexes),
        }),
      }),
    }))
  }

  function addChildBlock(path, block) {
    setProgram(p => ({
      ...p,
      divisions: p.divisions.map(d => d.id !== path.divisionId ? d : {
        ...d,
        subdivisions: d.subdivisions.map(s => s.id !== path.subId ? s : {
          ...s,
          blocks: mutateAtPath(s.blocks, path.indexes, b => ({
            ...b,
            children: [...(b.children || []), cloneBlockDef(block)],
          })),
        }),
      }),
    }))
  }

  function moveBlock({ fromDivisionId, fromSubId, blockId, toDivisionId, toSubId, toContainerId }) {
    setProgram(p => ({
      ...p,
      divisions: p.divisions.map(d => {
        const touchesFrom = d.id === fromDivisionId
        const touchesTo   = d.id === toDivisionId
        if (!touchesFrom && !touchesTo) return d
        // Extract the block from the source subdivision (within this division).
        let extracted = null
        let subs = d.subdivisions.map(s => {
          if (s.id !== fromSubId) return s
          const res = extractBlockById(s.blocks, blockId)
          extracted = res.extracted
          return { ...s, blocks: res.blocks }
        })
        if (!extracted) return d
        // Prevent dropping a container block into one of its own descendants.
        if (toContainerId && isInSubtree(extracted, toContainerId)) {
          return d // no-op; drop was invalid
        }
        // Insert into target subdivision (which may be the same one).
        subs = subs.map(s => {
          if (s.id !== toSubId) return s
          if (!toContainerId) return { ...s, blocks: [...s.blocks, extracted] }
          return { ...s, blocks: appendIntoContainer(s.blocks, toContainerId, extracted) }
        })
        return { ...d, subdivisions: subs }
      }),
    }))
  }

  function handleClear() {
    if (program.divisions.length === 0) return
    if (!confirm('Clear the entire working space?')) return
    setProgram(p => ({ ...p, divisions: [] }))
    setActiveDivisionId(null); setActiveSubdivisionId(null)
    log('Working space cleared.', 'warn')
  }

  function handleStop() {
    setRunning(false)
    log('STOP: all robots halted.', 'warn')
  }

  function handleSend() {
    const payload = serializeProgram(program)
    const json = JSON.stringify(payload, null, 2)
    // Copy to clipboard if available, else just log.
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(json).catch(() => {})
    }
    log(`SEND: ${payload.divisions.length} division(s), ${payload.divisions.reduce((n, d) => n + d.sequence.length, 0)} step(s). JSON copied.`, 'send')
    setRunning(true)
    setTimeout(() => setRunning(false), 1500)
    console.log('[Robokido SEND payload]', payload)
  }

  function handleRobotsUpdate(robots) {
    setProgram(p => ({ ...p, robots }))
  }

  return (
    <div className="rk-root" data-locked={locked}>
      <TopBar
        onClear={handleClear}
        onStop={handleStop}
        onSend={handleSend}
        onPreview={() => {
          if (program.divisions.length === 0) {
            log('Add a Division first.', 'warn'); return
          }
          setShowPreview(true)
        }}
        onIDE={() => setShowIDE(v => !v)}
        onSettings={() => setShowSettings(true)}
        onTogglePalette={() => setMobilePalette(v => !v)}
        onToggleDebug={() => setMobileDebug(v => !v)}
        running={running}
      />

      <div className="rk-main">
        <Palette
          mobileOpen={mobilePalette}
          onCloseMobile={() => setMobilePalette(false)}
          onPickMotion={name => { addBlockToActive({ kind: 'motion', type: name }); setMobilePalette(false) }}
          onPickControl={def => { addBlockToActive({ kind: 'control', type: def.type, params: def.params, container: def.container }); setMobilePalette(false) }}
        />

        <Canvas
          program={program}
          activeDivisionId={activeDivisionId}
          activeSubdivisionId={activeSubdivisionId}
          setActiveDivisionId={setActiveDivisionId}
          setActiveSubdivisionId={setActiveSubdivisionId}
          onAddDivision={addDivision}
          onUpdateDivision={updateDivision}
          onRemoveDivision={removeDivision}
          onAddSubdivision={addSubdivision}
          onUpdateSubdivision={updateSubdivision}
          onRemoveSubdivision={removeSubdivision}
          onAppendToSequence={appendToSequence}
          onRemoveFromSequence={removeFromSequence}
          onUpdateBlock={updateBlock}
          onRemoveBlock={removeBlock}
          onAddChildBlock={addChildBlock}
          onMoveBlock={moveBlock}
          zoom={zoom}
          locked={locked}
        />

        <DebugPanel
          log={debugLog}
          onClear={() => setDebugLog([])}
          showIDE={showIDE}
          onToggleIDE={() => setShowIDE(v => !v)}
          onCloseMobile={() => setMobileDebug(false)}
          mobileOpen={mobileDebug}
          program={program}
        />

        <div
          className="rk-drawer-backdrop"
          data-side="left"
          data-open={mobilePalette}
          onClick={() => setMobilePalette(false)}
        />
        <div
          className="rk-drawer-backdrop"
          data-side="right"
          data-open={mobileDebug}
          onClick={() => setMobileDebug(false)}
        />
      </div>

      <BottomBar
        zoom={zoom}
        setZoom={setZoom}
        locked={locked}
        setLocked={setLocked}
      />

      {showSettings && (
        <SettingsModal
          robots={program.robots}
          onClose={() => setShowSettings(false)}
          onSave={handleRobotsUpdate}
        />
      )}

      {showPreview && (
        <PreviewModal
          program={program}
          initialDivisionId={activeDivisionId}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}

function TopBar({ onClear, onStop, onSend, onPreview, onIDE, onSettings, onTogglePalette, onToggleDebug, running }) {
  return (
    <header className="rk-top">
      <div className="rk-top-left">
        <button className="rk-btn-icon rk-mobile-only" onClick={onTogglePalette} aria-label="Open blocks">☰</button>
        <button className="rk-btn rk-desktop-only" onClick={onClear} title="Clear workspace">CLEAR</button>
        <button className="rk-btn rk-btn-warn rk-desktop-only" onClick={onStop} title="Halt all robots">STOP</button>
      </div>
      <div className="rk-top-title">
        <span className="rk-logo">🤖</span>
        <span className="rk-brand">Robokido IDE</span>
        {running && <span className="rk-pill rk-pill-live">● SENDING</span>}
      </div>
      <div className="rk-top-right">
        <button className="rk-btn rk-btn-preview" onClick={onPreview} title="Preview on virtual robot">
          <span>▶</span><span className="rk-desktop-only">Preview</span>
        </button>
        <button className="rk-btn rk-btn-primary" onClick={onSend} title="Send program as JSON">SEND</button>
        <button className="rk-btn rk-desktop-only" onClick={onIDE} title="Toggle raw JSON view">IDE</button>
        <button className="rk-btn-icon rk-mobile-only" onClick={onToggleDebug} aria-label="Debug panel">📋</button>
        <button className="rk-btn rk-desktop-only" onClick={onSettings} title="Settings">⚙ Setting</button>
        <button className="rk-btn-icon rk-mobile-only" onClick={onSettings} aria-label="Settings">⚙</button>
      </div>
    </header>
  )
}

function Palette({ onPickMotion, onPickControl, mobileOpen, onCloseMobile }) {
  const [tab, setTab] = useState('motions')
  const [query, setQuery] = useState('')
  const filteredMotions = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? MOTION_BLOCKS.filter(m => m.toLowerCase().includes(q)) : MOTION_BLOCKS
  }, [query])

  return (
    <aside className="rk-palette" data-open={mobileOpen || undefined}>
      <div className="rk-palette-head">
        <h4>Blocks</h4>
        <button className="rk-icon-btn" onClick={onCloseMobile} aria-label="Close">×</button>
      </div>
      <div className="rk-palette-tabs">
        <button
          className={`rk-tab ${tab === 'motions' ? 'rk-tab-active' : ''}`}
          onClick={() => setTab('motions')}
        >motions</button>
        <button
          className={`rk-tab ${tab === 'controls' ? 'rk-tab-active' : ''}`}
          onClick={() => setTab('controls')}
        >controls</button>
      </div>

      {tab === 'motions' && (
        <>
          <input
            className="rk-search"
            placeholder="search…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <div className="rk-palette-list">
            {filteredMotions.map(name => (
              <button
                key={name}
                className="rk-block rk-block-motion"
                draggable
                onDragStart={e => e.dataTransfer.setData('application/x-rk-block', JSON.stringify({ kind: 'motion', type: name }))}
                onClick={() => onPickMotion(name)}
                title="Click to add to active subdivision, or drag onto a subdivision"
              >
                <span className="rk-block-icon">🦿</span>
                <span className="rk-block-label">{name}</span>
              </button>
            ))}
            {filteredMotions.length === 0 && (
              <p className="rk-empty">No matches.</p>
            )}
          </div>
        </>
      )}

      {tab === 'controls' && (
        <div className="rk-palette-list">
          {CONTROL_BLOCKS.map(def => (
            <button
              key={def.type}
              className="rk-block rk-block-control"
              draggable
              onDragStart={e => e.dataTransfer.setData('application/x-rk-block', JSON.stringify({ kind: 'control', type: def.type, params: def.params, container: def.container }))}
              onClick={() => onPickControl(def)}
              title={def.container ? 'Container block — accepts children' : 'Statement block'}
            >
              <span className="rk-block-icon">{def.container ? '⟳' : '•'}</span>
              <span className="rk-block-label">{def.type}</span>
            </button>
          ))}
        </div>
      )}
    </aside>
  )
}

function Canvas(props) {
  const {
    program, activeDivisionId, activeSubdivisionId,
    setActiveDivisionId, setActiveSubdivisionId,
    onAddDivision, onUpdateDivision, onRemoveDivision,
    onAddSubdivision, onUpdateSubdivision, onRemoveSubdivision,
    onAppendToSequence, onRemoveFromSequence,
    onUpdateBlock, onRemoveBlock, onAddChildBlock, onMoveBlock,
    zoom, locked,
  } = props

  return (
    <section className="rk-canvas-wrap">
      <div
        className="rk-canvas"
        style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
      >
        {program.divisions.length === 0 && (
          <EmptyCanvas onAdd={onAddDivision} />
        )}

        {program.divisions.map(div => (
          <Division
            key={div.id}
            division={div}
            robots={program.robots}
            isActive={activeDivisionId === div.id}
            activeSubdivisionId={activeDivisionId === div.id ? activeSubdivisionId : null}
            onFocus={() => setActiveDivisionId(div.id)}
            onPatch={patch => onUpdateDivision(div.id, patch)}
            onRemove={() => onRemoveDivision(div.id)}
            onAddSub={() => onAddSubdivision(div.id)}
            onPatchSub={(subId, patch) => onUpdateSubdivision(div.id, subId, patch)}
            onRemoveSub={(subId) => onRemoveSubdivision(div.id, subId)}
            onSelectSub={(subId) => { setActiveDivisionId(div.id); setActiveSubdivisionId(subId) }}
            onAppendToSequence={(subId) => onAppendToSequence(div.id, subId)}
            onRemoveFromSequence={(index) => onRemoveFromSequence(div.id, index)}
            onUpdateBlock={onUpdateBlock}
            onRemoveBlock={onRemoveBlock}
            onAddChildBlock={onAddChildBlock}
            onMoveBlock={onMoveBlock}
            locked={locked}
          />
        ))}

        {program.divisions.length > 0 && !locked && (
          <button className="rk-btn rk-add-division" onClick={onAddDivision}>
            + Division
          </button>
        )}
      </div>
    </section>
  )
}

function EmptyCanvas({ onAdd }) {
  return (
    <div className="rk-empty-canvas">
      <h2>Working Space</h2>
      <p>Create a Division to begin. Each Division runs on one humanoid robot. Subdivisions chain in sequence (e.g. Sub 1 → Sub 3 → Sub 1).</p>
      <button className="rk-btn rk-btn-primary rk-btn-big" onClick={onAdd}>+ Add first Division</button>
    </div>
  )
}

function Division(props) {
  const {
    division, robots, isActive, activeSubdivisionId,
    onFocus, onPatch, onRemove, onAddSub, onPatchSub, onRemoveSub,
    onSelectSub, onAppendToSequence, onRemoveFromSequence,
    onUpdateBlock, onRemoveBlock, onAddChildBlock, onMoveBlock, locked,
  } = props

  const activeSub = division.subdivisions.find(s => s.id === activeSubdivisionId)
    || division.subdivisions[0]
    || null

  return (
    <article
      className={`rk-division ${isActive ? 'rk-division-active' : ''}`}
      onMouseDown={onFocus}
    >
      <header className="rk-division-head">
        <input
          className="rk-division-name"
          value={division.name}
          onChange={e => onPatch({ name: e.target.value })}
          disabled={locked}
        />
        <label className="rk-robot-pick">
          <span>Robot:</span>
          <select
            value={division.robotId || ''}
            onChange={e => onPatch({ robotId: e.target.value })}
            disabled={locked}
          >
            {robots.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        {!locked && (
          <button className="rk-icon-btn" onClick={onRemove} title="Remove division">×</button>
        )}
      </header>

      <section className="rk-sub-row">
        <h4>Subdivisions <span className="rk-hint-inline">— click to edit · double-click name to rename · → appends to sequence</span></h4>
        <div className="rk-chips">
          {division.subdivisions.map(s => (
            <SubdivisionChip
              key={s.id}
              sub={s}
              isActive={activeSub?.id === s.id}
              locked={locked}
              onSelect={() => onSelectSub(s.id)}
              onRename={name => onPatchSub(s.id, { name })}
              onAppend={() => onAppendToSequence(s.id)}
              onRemove={() => onRemoveSub(s.id)}
            />
          ))}
          {!locked && (
            <button className="rk-chip rk-chip-add" onClick={onAddSub}>+ Sub</button>
          )}
        </div>
      </section>

      <section className="rk-seq-row">
        <h4>Sequence</h4>
        <div className="rk-seq">
          {division.sequence.length === 0 && (
            <span className="rk-seq-empty">Click → on a subdivision to append.</span>
          )}
          {division.sequence.map((subId, i) => {
            const sub = division.subdivisions.find(s => s.id === subId)
            return (
              <React.Fragment key={`${subId}-${i}`}>
                {i > 0 && <span className="rk-seq-arrow">→</span>}
                <span className="rk-seq-step">
                  {sub?.name || '???'}
                  {!locked && (
                    <span className="rk-seq-x" onClick={() => onRemoveFromSequence(i)}>×</span>
                  )}
                </span>
              </React.Fragment>
            )
          })}
        </div>
      </section>

      {activeSub && (
        <section className="rk-editor">
          <div className="rk-editor-head">
            <h4>Editing: <em>{activeSub.name}</em></h4>
            <span className="rk-editor-hint">
              Click a palette block to add. Drag an existing block onto a container's dashed area to nest it, or into empty space to move it out.
            </span>
          </div>
          <SubdivisionEditor
            divisionId={division.id}
            subdivision={activeSub}
            onUpdateBlock={onUpdateBlock}
            onRemoveBlock={onRemoveBlock}
            onAddChildBlock={onAddChildBlock}
            onMoveBlock={onMoveBlock}
            onAppendBlock={(block) => onPatchSub(activeSub.id, { blocks: [...activeSub.blocks, cloneBlockDef(block)] })}
            locked={locked}
          />
        </section>
      )}
    </article>
  )
}

function SubdivisionChip({ sub, isActive, locked, onSelect, onRename, onAppend, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(sub.name)
  const inputRef = useRef(null)

  useEffect(() => { if (!editing) setDraft(sub.name) }, [sub.name, editing])
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  function commit() {
    const name = draft.trim() || sub.name
    if (name !== sub.name) onRename(name)
    setEditing(false)
  }
  function cancel() {
    setDraft(sub.name)
    setEditing(false)
  }

  return (
    <div
      className={`rk-chip ${isActive ? 'rk-chip-active' : ''}`}
      onClick={() => { if (!editing) onSelect() }}
      role="button"
      tabIndex={0}
      title="Click to edit this subdivision"
    >
      {editing ? (
        <input
          ref={inputRef}
          className="rk-chip-name rk-chip-name-editing"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') cancel()
          }}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span
          className="rk-chip-name-display"
          onDoubleClick={e => { e.stopPropagation(); if (!locked) setEditing(true) }}
          title="Double-click to rename"
        >
          {sub.name}
        </span>
      )}
      {!locked && !editing && (
        <>
          <span
            className="rk-chip-arrow"
            onClick={e => { e.stopPropagation(); onAppend() }}
            title="Append to sequence"
          >→</span>
          <span
            className="rk-chip-x"
            onClick={e => { e.stopPropagation(); onRemove() }}
            title="Remove subdivision"
          >×</span>
        </>
      )}
    </div>
  )
}

function SubdivisionEditor({ divisionId, subdivision, onUpdateBlock, onRemoveBlock, onAddChildBlock, onMoveBlock, onAppendBlock, locked }) {
  function onDrop(e) {
    e.preventDefault()
    // Existing block being moved out to top-level?
    const moveRaw = e.dataTransfer.getData('application/x-rk-move')
    if (moveRaw) {
      try {
        const { fromDivisionId, fromSubId, blockId } = JSON.parse(moveRaw)
        onMoveBlock?.({
          fromDivisionId, fromSubId, blockId,
          toDivisionId: divisionId, toSubId: subdivision.id, toContainerId: null,
        })
      } catch {}
      return
    }
    // Fresh block from the palette.
    const raw = e.dataTransfer.getData('application/x-rk-block')
    if (!raw) return
    try {
      const block = JSON.parse(raw)
      onAppendBlock(block)
    } catch {}
  }
  function onDragOver(e) {
    if (
      e.dataTransfer.types.includes('application/x-rk-block') ||
      e.dataTransfer.types.includes('application/x-rk-move')
    ) e.preventDefault()
  }

  return (
    <div
      className="rk-blocks"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {subdivision.blocks.length === 0 && (
        <p className="rk-blocks-empty">Drop blocks here, or click a block in the palette.</p>
      )}
      {subdivision.blocks.map((b, i) => (
        <BlockNode
          key={b.id}
          block={b}
          path={{ divisionId, subId: subdivision.id, indexes: [i] }}
          onUpdateBlock={onUpdateBlock}
          onRemoveBlock={onRemoveBlock}
          onAddChildBlock={onAddChildBlock}
          onMoveBlock={onMoveBlock}
          locked={locked}
        />
      ))}
    </div>
  )
}

function BlockNode({ block, path, onUpdateBlock, onRemoveBlock, onAddChildBlock, onMoveBlock, locked }) {
  const [expanded, setExpanded] = useState(true)
  const isContainer = block.kind === 'control' && block.container

  function patchParam(key, value) {
    onUpdateBlock(path, { params: { ...block.params, [key]: value } })
  }

  function onNodeDragStart(e) {
    if (locked) return
    e.stopPropagation()
    e.dataTransfer.setData('application/x-rk-move', JSON.stringify({
      fromDivisionId: path.divisionId,
      fromSubId: path.subId,
      blockId: block.id,
    }))
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDropChild(e) {
    e.preventDefault()
    e.stopPropagation()
    // Existing block being moved INTO this container.
    const moveRaw = e.dataTransfer.getData('application/x-rk-move')
    if (moveRaw) {
      try {
        const { fromDivisionId, fromSubId, blockId } = JSON.parse(moveRaw)
        if (blockId === block.id) return // can't drop into self
        onMoveBlock?.({
          fromDivisionId, fromSubId, blockId,
          toDivisionId: path.divisionId, toSubId: path.subId, toContainerId: block.id,
        })
      } catch {}
      return
    }
    // Fresh block from the palette.
    const raw = e.dataTransfer.getData('application/x-rk-block')
    if (!raw) return
    try {
      const child = JSON.parse(raw)
      onAddChildBlock(path, child)
    } catch {}
  }
  function onDragOverChild(e) {
    if (
      e.dataTransfer.types.includes('application/x-rk-block') ||
      e.dataTransfer.types.includes('application/x-rk-move')
    ) {
      e.preventDefault(); e.stopPropagation()
    }
  }

  return (
    <div
      className={`rk-node rk-node-${block.kind}`}
      draggable={!locked}
      onDragStart={onNodeDragStart}
    >
      <div className="rk-node-head">
        <span className="rk-node-grip" title="Drag to move">⋮⋮</span>
        <button className="rk-node-toggle" onClick={() => setExpanded(x => !x)}>
          {isContainer ? (expanded ? '▾' : '▸') : '•'}
        </button>
        <span className="rk-node-type">{block.type}</span>
        {!locked && (
          <button className="rk-node-x" onClick={() => onRemoveBlock(path)} title="Remove">×</button>
        )}
      </div>

      {expanded && (
        <div className="rk-node-body">
          <ParamsEditor params={block.params || {}} onChange={patchParam} locked={locked} />

          {isContainer && (
            <div
              className="rk-children"
              onDragOver={onDragOverChild}
              onDrop={onDropChild}
            >
              {(block.children || []).length === 0 && (
                <p className="rk-children-empty">Drop child block(s) here.</p>
              )}
              {(block.children || []).map((c, j) => (
                <BlockNode
                  key={c.id}
                  block={c}
                  path={{ ...path, indexes: [...path.indexes, j] }}
                  onUpdateBlock={onUpdateBlock}
                  onRemoveBlock={onRemoveBlock}
                  onAddChildBlock={onAddChildBlock}
                  onMoveBlock={onMoveBlock}
                  locked={locked}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ParamsEditor({ params, onChange, locked }) {
  const keys = Object.keys(params)
  if (keys.length === 0) return null
  return (
    <div className="rk-params">
      {keys.map(k => {
        if (k === 'direction') {
          return (
            <label key={k} className="rk-param">
              <span>Direction</span>
              <select value={params[k]} onChange={e => onChange(k, e.target.value)} disabled={locked}>
                {DIRECTIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
          )
        }
        const range = PARAM_RANGES[k]
        if (range) {
          return (
            <label key={k} className="rk-param">
              <span>{labelFor(k)}</span>
              <input
                type="number"
                min={range.min} max={range.max} step={range.step}
                value={params[k]}
                onChange={e => onChange(k, clamp(Number(e.target.value), range.min, range.max))}
                disabled={locked}
              />
              <small>{range.suffix}</small>
            </label>
          )
        }
        // Generic text / numeric params on control blocks (condition, times, iterator, …)
        const asText = typeof params[k] === 'string'
        return (
          <label key={k} className="rk-param">
            <span>{labelFor(k)}</span>
            <input
              type={asText ? 'text' : 'number'}
              value={params[k]}
              onChange={e => onChange(k, asText ? e.target.value : Number(e.target.value))}
              disabled={locked}
            />
          </label>
        )
      })}
    </div>
  )
}

function DebugPanel({ log, onClear, showIDE, onToggleIDE, mobileOpen, onCloseMobile, program }) {
  const payload = serializeProgram(program)
  return (
    <aside className="rk-debug" data-open={mobileOpen || undefined}>
      <div className="rk-debug-head">
        <h4>{showIDE ? 'IDE — JSON' : 'Debug'}</h4>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="rk-btn-small" onClick={onToggleIDE}>
            {showIDE ? 'Log' : 'IDE'}
          </button>
          {showIDE
            ? <button className="rk-btn-small" onClick={() => { try { navigator.clipboard.writeText(JSON.stringify(payload, null, 2)) } catch {} }}>copy</button>
            : <button className="rk-btn-small" onClick={onClear}>Clear</button>
          }
          <button className="rk-icon-btn rk-mobile-only" onClick={onCloseMobile} aria-label="Close">×</button>
        </div>
      </div>
      {showIDE
        ? <pre className="rk-json">{JSON.stringify(payload, null, 2)}</pre>
        : (
          <ul className="rk-log">
            {log.length === 0 && <li className="rk-log-empty">No events.</li>}
            {log.slice().reverse().map((e, i) => (
              <li key={i} className={`rk-log-${e.kind}`}>
                <time>{new Date(e.t).toLocaleTimeString()}</time>
                <span>{e.msg}</span>
              </li>
            ))}
          </ul>
        )
      }
    </aside>
  )
}

function BottomBar({ zoom, setZoom, locked, setLocked }) {
  return (
    <footer className="rk-bottom">
      <button className="rk-btn-small" onClick={() => setZoom(z => clamp(+(z - 0.1).toFixed(2), 0.4, 2))} aria-label="Zoom out">−</button>
      <span className="rk-zoom-val">{Math.round(zoom * 100)}%</span>
      <button className="rk-btn-small" onClick={() => setZoom(z => clamp(+(z + 0.1).toFixed(2), 0.4, 2))} aria-label="Zoom in">+</button>
      <button className="rk-btn-small" onClick={() => setZoom(1)}>Fit</button>
      <span className="rk-bottom-spacer" />
      <button
        className={`rk-btn-small ${locked ? 'rk-btn-on' : ''}`}
        onClick={() => setLocked(v => !v)}
      >
        {locked ? '🔒 Locked' : '🔓 Lock'}
      </button>
    </footer>
  )
}

function SettingsModal({ robots, onClose, onSave }) {
  const [draft, setDraft] = useState(robots)
  const [endpoint, setEndpoint] = useState(() => localStorage.getItem('robokido:endpoint') || '')

  function addRobot() {
    setDraft(d => [...d, { id: uid('robot'), name: `Robot ${d.length + 1}` }])
  }
  function patchRobot(id, name) {
    setDraft(d => d.map(r => r.id === id ? { ...r, name } : r))
  }
  function removeRobot(id) {
    setDraft(d => d.filter(r => r.id !== id))
  }
  function save() {
    onSave(draft.length ? draft : [{ id: 'robot-1', name: 'Robot 1' }])
    try { localStorage.setItem('robokido:endpoint', endpoint) } catch {}
    onClose()
  }

  return (
    <div className="rk-modal-backdrop" onClick={onClose}>
      <div className="rk-modal" onClick={e => e.stopPropagation()}>
        <h3>Settings</h3>

        <section>
          <h4>Robots</h4>
          <ul className="rk-robot-list">
            {draft.map(r => (
              <li key={r.id}>
                <input value={r.name} onChange={e => patchRobot(r.id, e.target.value)} />
                <button className="rk-icon-btn" onClick={() => removeRobot(r.id)}>×</button>
              </li>
            ))}
          </ul>
          <button className="rk-btn-small" onClick={addRobot}>+ Add robot</button>
        </section>

        <section>
          <h4>Backend endpoint</h4>
          <input
            className="rk-endpoint"
            placeholder="https://robot.local/send"
            value={endpoint}
            onChange={e => setEndpoint(e.target.value)}
          />
          <p className="rk-hint">Tell us where your robot lives on the network and we'll deliver your programs straight to it when you hit SEND. Leave it blank and we'll pop the code onto your clipboard instead — great for testing.</p>
        </section>

        <footer className="rk-modal-foot">
          <button className="rk-btn" onClick={onClose}>Cancel</button>
          <button className="rk-btn rk-btn-primary" onClick={save}>Save</button>
        </footer>
      </div>
    </div>
  )
}

function cloneBlockDef(def) {
  const id = uid('b')
  if (def.kind === 'motion') {
    return { id, kind: 'motion', type: def.type, params: paramsForMotion(def.type) }
  }
  // control
  return {
    id, kind: 'control', type: def.type,
    container: !!def.container,
    params: deepClone(def.params || {}),
    children: def.container ? [] : undefined,
  }
}

function deepClone(x) { return JSON.parse(JSON.stringify(x)) }

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)) }

function labelFor(key) {
  switch (key) {
    case 'time':      return 'Time'
    case 'speed':     return 'Speed'
    case 'degree':    return 'Degree'
    case 'direction': return 'Direction'
    case 'times':     return 'Times'
    case 'condition': return 'Condition'
    case 'iterator':  return 'Iterator'
    case 'from':      return 'From'
    case 'to':        return 'To'
    default: return key[0].toUpperCase() + key.slice(1)
  }
}

function extractBlockById(blocks, id) {
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].id === id) {
      return { blocks: blocks.filter((_, idx) => idx !== i), extracted: blocks[i] }
    }
    if (blocks[i].children) {
      const sub = extractBlockById(blocks[i].children, id)
      if (sub.extracted) {
        const newChildren = sub.blocks
        return {
          blocks: blocks.map((b, idx) => idx === i ? { ...b, children: newChildren } : b),
          extracted: sub.extracted,
        }
      }
    }
  }
  return { blocks, extracted: null }
}

function appendIntoContainer(blocks, containerId, child) {
  return blocks.map(b => {
    if (b.id === containerId) {
      return { ...b, children: [...(b.children || []), child] }
    }
    if (b.children) {
      return { ...b, children: appendIntoContainer(b.children, containerId, child) }
    }
    return b
  })
}

function isInSubtree(block, targetId) {
  if (block.id === targetId) return true
  if (!block.children) return false
  return block.children.some(c => isInSubtree(c, targetId))
}

function mutateAtPath(blocks, indexes, mutator) {
  const [head, ...rest] = indexes
  return blocks.map((b, i) => {
    if (i !== head) return b
    if (rest.length === 0) return mutator(b)
    return { ...b, children: mutateAtPath(b.children || [], rest, mutator) }
  })
}
function removeAtPath(blocks, indexes) {
  const [head, ...rest] = indexes
  if (rest.length === 0) return blocks.filter((_, i) => i !== head)
  return blocks.map((b, i) => {
    if (i !== head) return b
    return { ...b, children: removeAtPath(b.children || [], rest) }
  })
}

function serializeProgram(program) {
  return {
    robots: program.robots,
    divisions: program.divisions.map(d => ({
      id: d.id,
      name: d.name,
      robot: program.robots.find(r => r.id === d.robotId)?.name || null,
      subdivisions: d.subdivisions.map(s => ({
        id: s.id,
        name: s.name,
        nodes: s.blocks.map(serializeBlock),
      })),
      sequence: d.sequence.map(id => d.subdivisions.find(s => s.id === id)?.name || id),
    })),
  }
}

function serializeBlock(b) {
  if (b.kind === 'motion') {
    const node = { Motion: b.type }
    if (b.params.time    != null) node.Time    = `${b.params.time} Sec`
    if (b.params.speed   != null) node.Speed   = `${b.params.speed}%`
    if (b.params.degree  != null) node.Degree  = `${b.params.degree} Deg`
    if (b.params.direction)       node.Direction = b.params.direction
    return node
  }
  // control
  const node = { Control: b.type, ...b.params }
  if (b.container) node.Body = (b.children || []).map(serializeBlock)
  return node
}
