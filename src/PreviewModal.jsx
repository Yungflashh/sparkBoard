import React, { useEffect, useMemo, useRef, useState } from 'react'
import { defaultPose, flattenSequence, applyBlock, stepDurationMs } from './preview.js'

const APPLE_X = 170
const HOUSE_X = -170
const REACH_RADIUS = 35

export default function PreviewModal({ program, initialDivisionId, onClose }) {
  const divisions = program.divisions
  const [divisionId, setDivisionId] = useState(() => initialDivisionId || divisions[0]?.id || null)
  const division = divisions.find(d => d.id === divisionId) || null
  const robotName = program.robots.find(r => r.id === division?.robotId)?.name || '—'

  const steps = useMemo(() => division ? flattenSequence(division) : [], [division])

  const [playing, setPlaying] = useState(false)
  const [stepIndex, setStepIndex] = useState(-1) // -1 = at rest
  const [multiplier, setMultiplier] = useState(1)
  const [pose, setPose] = useState(defaultPose())

  const [missionOn, setMissionOn] = useState(false)
  const [mission, setMission] = useState({ reached: false, picked: false, home: false })

  const timerRef = useRef(null)
  useEffect(() => () => clearTimer(), [])
  function clearTimer() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
  }

  useEffect(() => {
    if (!missionOn) return
    setMission(m => {
      const nearApple = Math.abs(pose.x - APPLE_X) <= REACH_RADIUS
      const nearHouse = Math.abs(pose.x - HOUSE_X) <= REACH_RADIUS
      const handUp = Math.abs(pose.leftArm.shoulder) >= 100 || Math.abs(pose.rightArm.shoulder) >= 100
      const reached = m.reached || nearApple
      const picked  = m.picked  || (reached && handUp)
      const home    = m.home    || (picked && nearHouse)
      if (reached === m.reached && picked === m.picked && home === m.home) return m
      return { reached, picked, home }
    })
  }, [pose, missionOn])

  function restart() {
    clearTimer()
    setStepIndex(-1)
    setPose(defaultPose())
    setPlaying(false)
    setMission({ reached: false, picked: false, home: false })
  }

  function play() {
    if (steps.length === 0) return
    setPlaying(true)
    const nextIndex = stepIndex < 0 || stepIndex >= steps.length ? 0 : stepIndex
    advanceTo(nextIndex)
  }
  function pause() {
    setPlaying(false)
    clearTimer()
  }

  function advanceTo(idx) {
    if (idx >= steps.length) { setPlaying(false); return }
    const step = steps[idx]
    setStepIndex(idx)
    setPose(prev => applyBlock(prev, step))
    const ms = stepDurationMs(step, multiplier)
    clearTimer()
    timerRef.current = setTimeout(() => advanceTo(idx + 1), ms)
  }

  function stepForward() {
    pause()
    const nxt = Math.min(stepIndex + 1, steps.length - 1)
    const step = steps[nxt]
    setStepIndex(nxt)
    setPose(prev => applyBlock(prev, step))
  }
  function stepBack() {
    pause()
    const target = Math.max(stepIndex - 1, -1)
    let p = defaultPose()
    for (let i = 0; i <= target; i++) p = applyBlock(p, steps[i])
    setPose(p)
    setStepIndex(target)
    setMission({ reached: false, picked: false, home: false })
  }

  useEffect(() => { restart() /* eslint-disable-line */ }, [divisionId])
  useEffect(() => {
    if (playing && stepIndex >= 0 && stepIndex < steps.length) {
      const ms = stepDurationMs(steps[stepIndex], multiplier)
      clearTimer()
      const i = stepIndex
      timerRef.current = setTimeout(() => advanceTo(i + 1), ms)
    }
    // eslint-disable-next-line
  }, [multiplier])

  useEffect(() => {
    if (missionOn) { restart() }
    // eslint-disable-next-line
  }, [missionOn])

  const currentStep = stepIndex >= 0 ? steps[stepIndex] : null
  const missionComplete = mission.reached && mission.picked && mission.home

  return (
    <div className="rk-modal-backdrop" onClick={onClose}>
      <div className="rk-preview" onClick={e => e.stopPropagation()}>
        <header className="rk-preview-head">
          <div>
            <h3>Preview {missionOn && <span className="rk-mission-tag">🎯 Mission</span>}</h3>
            <p className="rk-preview-meta">
              Division:
              <select
                value={divisionId || ''}
                onChange={e => setDivisionId(e.target.value)}
                disabled={divisions.length < 2}
              >
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <span className="rk-preview-robot">Robot: <strong>{robotName}</strong></span>
              <span className="rk-preview-count">{steps.length} step{steps.length === 1 ? '' : 's'}</span>
            </p>
          </div>
          <button className="rk-icon-btn rk-preview-close" onClick={onClose} title="Close">×</button>
        </header>

        {missionOn && (
          <section className="rk-mission-bar">
            <strong>Mission:</strong>
            <span>Walk the robot to the <b>apple</b> → <b>lift a hand</b> to grab it → carry it back to the <b>house</b>.</span>
          </section>
        )}

        <section className="rk-stage">
          <RobotFigure pose={pose} mission={missionOn ? mission : null} />
          {missionOn && (
            <div className="rk-mission-check">
              <Check done={mission.reached}>Reached the apple</Check>
              <Check done={mission.picked}>Picked it up</Check>
              <Check done={mission.home}>Carried it home</Check>
            </div>
          )}
          {missionOn && missionComplete && (
            <div className="rk-mission-win">🏆 Mission complete!</div>
          )}
        </section>

        <section className="rk-preview-caption">
          {currentStep
            ? (
              <>
                <span className="rk-cap-sub">{currentStep.subName}</span>
                <span className="rk-cap-sep">·</span>
                <span className="rk-cap-type">{currentStep.label}</span>
                {currentStep.kind === 'motion' && (
                  <span className="rk-cap-params">
                    {currentStep.block.params?.time    != null && <>Time <b>{currentStep.block.params.time}s</b></>}
                    {currentStep.block.params?.speed   != null && <>Speed <b>{currentStep.block.params.speed}%</b></>}
                    {currentStep.block.params?.degree  != null && <>Degree <b>{currentStep.block.params.degree}°</b></>}
                    {currentStep.block.params?.direction && <>Dir <b>{currentStep.block.params.direction}</b></>}
                  </span>
                )}
              </>
            )
            : (steps.length === 0
              ? <span className="rk-cap-empty">Nothing to preview — add blocks to a subdivision and append it to the sequence.</span>
              : <span className="rk-cap-empty">Press ▶ Play to run through {steps.length} step{steps.length === 1 ? '' : 's'}.</span>)
          }
        </section>

        <section className="rk-timeline">
          {steps.map((s, i) => (
            <button
              key={i}
              className={`rk-tl-step rk-tl-${s.kind} ${i === stepIndex ? 'rk-tl-active' : ''} ${i < stepIndex ? 'rk-tl-done' : ''}`}
              onClick={() => {
                pause()
                let p = defaultPose()
                for (let k = 0; k <= i; k++) p = applyBlock(p, steps[k])
                setPose(p); setStepIndex(i)
                setMission({ reached: false, picked: false, home: false })
              }}
              title={`${s.subName} · ${s.label}`}
            >
              <span className="rk-tl-num">{i + 1}</span>
              <span className="rk-tl-label">{s.label}</span>
            </button>
          ))}
        </section>

        <footer className="rk-preview-foot">
          <div className="rk-transport">
            <button className="rk-btn-small" onClick={restart} title="Restart">⟲</button>
            <button className="rk-btn-small" onClick={stepBack} disabled={stepIndex < 0}>⏮</button>
            {playing
              ? <button className="rk-btn rk-btn-primary" onClick={pause}>⏸ Pause</button>
              : <button className="rk-btn rk-btn-primary" onClick={play} disabled={steps.length === 0}>▶ Play</button>
            }
            <button className="rk-btn-small" onClick={stepForward} disabled={stepIndex >= steps.length - 1}>⏭</button>
          </div>
          <div className="rk-mission-toggle">
            <label className="rk-switch">
              <input type="checkbox" checked={missionOn} onChange={e => setMissionOn(e.target.checked)} />
              <span>🎯 Mission mode</span>
            </label>
          </div>
          <div className="rk-speed">
            <span>Speed</span>
            {[0.5, 1, 2, 4].map(m => (
              <button
                key={m}
                className={`rk-btn-small ${multiplier === m ? 'rk-btn-on' : ''}`}
                onClick={() => setMultiplier(m)}
              >{m}×</button>
            ))}
          </div>
        </footer>
      </div>
    </div>
  )
}

function Check({ done, children }) {
  return (
    <div className={`rk-check ${done ? 'rk-check-done' : ''}`}>
      <span className="rk-check-mark">{done ? '✓' : '○'}</span>
      <span>{children}</span>
    </div>
  )
}

function RobotFigure({ pose, mission }) {
  const stageW = 460
  const stageH = 360
  const cx = stageW / 2
  const cy = stageH * 0.72

  let px
  if (mission) {
    px = cx + clamp(pose.x, -(cx - 50), cx - 50)
  } else {
    const span = stageW - 100
    const wrapped = ((pose.x % span) + span) % span
    px = 50 + wrapped
  }
  const py = clamp(cy + pose.y, 115, stageH - 20)

  const appleAttached = mission?.picked
  const appleX = appleAttached ? px : cx + APPLE_X
  const appleY = appleAttached ? py - 70 : stageH - 24

  const houseX = cx + HOUSE_X

  return (
    <svg viewBox={`0 0 ${stageW} ${stageH}`} className="rk-robot-svg">
      {/* Ground line + shadow */}
      <line x1="0" y1={stageH - 10} x2={stageW} y2={stageH - 10} stroke="rgba(0,0,0,0.12)" strokeWidth="1" />
      <ellipse cx={px} cy={stageH - 12} rx="50" ry="5" fill="rgba(0,0,0,0.15)" />

      {/* Mission props */}
      {mission && (
        <>
          {/* House */}
          <g className="rk-prop">
            <rect x={houseX - 32} y={stageH - 70} width="64" height="60" fill="#fde68a" stroke="#92400e" strokeWidth="2" />
            <polygon points={`${houseX - 40},${stageH - 70} ${houseX},${stageH - 105} ${houseX + 40},${stageH - 70}`} fill="#b45309" stroke="#78350f" strokeWidth="2" />
            <rect x={houseX - 10} y={stageH - 48} width="20" height="38" fill="#78350f" />
            <rect x={houseX + 14} y={stageH - 60} width="12" height="12" fill="#fef3c7" stroke="#92400e" />
            <text x={houseX} y={stageH - 112} textAnchor="middle" fontSize="11" fill="#92400e" fontWeight="700">HOME</text>
          </g>

          {/* Apple */}
          <g className="rk-prop rk-apple">
            <circle cx={appleX} cy={appleY} r="12" fill="#dc2626" stroke="#7f1d1d" strokeWidth="2" />
            <ellipse cx={appleX - 4} cy={appleY - 5} rx="3" ry="2" fill="#fca5a5" />
            <path d={`M ${appleX} ${appleY - 12} q 4 -6 10 -4`} stroke="#166534" strokeWidth="2" fill="none" strokeLinecap="round" />
            <rect x={appleX - 1} y={appleY - 16} width="2" height="6" fill="#78350f" />
          </g>
        </>
      )}

      <g
        className="rk-rig"
        style={{ transform: `translate(${px}px, ${py}px) rotate(${pose.bodyRot}deg)` }}
      >
        <Leg side="left"  pose={pose.leftLeg}  />
        <Leg side="right" pose={pose.rightLeg} />

        <g className="rk-part" style={{ transform: `rotate(${pose.torsoTilt}deg)`, transformOrigin: '0px 0px' }}>
          <rect x="-26" y="-80" width="52" height="80" rx="10" fill="#2563eb" />
          {pose.weight > 0 && (
            <g>
              <rect x="-50" y="-120" width="100" height="12" rx="3" fill="#374151" />
              <circle cx="-50" cy="-114" r="14" fill="#111827" />
              <circle cx="50"  cy="-114" r="14" fill="#111827" />
            </g>
          )}

          <g className="rk-part" style={{ transform: `translate(0, -80px) rotate(${pose.headTilt}deg)`, transformOrigin: '0px 0px' }}>
            <circle cx="0" cy="-22" r="22" fill="#f59e0b" stroke="#92400e" strokeWidth="2" />
            <circle cx="-8" cy="-26" r="3" fill="#1c1c1a" />
            <circle cx="8"  cy="-26" r="3" fill="#1c1c1a" />
            <path d="M -8 -14 Q 0 -8 8 -14" stroke="#1c1c1a" strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>

          <Arm side="left"  pose={pose.leftArm}  />
          <Arm side="right" pose={pose.rightArm} />
        </g>
      </g>
    </svg>
  )
}

function Arm({ side, pose }) {
  const sign = side === 'left' ? -1 : 1
  const shoulderX = sign * 26
  const shoulderY = -72
  return (
    <g
      className="rk-part rk-arm"
      style={{
        transform: `translate(${shoulderX}px, ${shoulderY}px) rotate(${pose.shoulder}deg)`,
        transformOrigin: '0px 0px',
      }}
    >
      <line x1="0" y1="0" x2="0" y2="34" stroke="#1d4ed8" strokeWidth="7" strokeLinecap="round" />
      <circle cx="0" cy="0" r="5" fill="#1e3a8a" />
      <g
        className="rk-part"
        style={{ transform: `translate(0px, 34px) rotate(${pose.elbow}deg)`, transformOrigin: '0px 0px' }}
      >
        <line x1="0" y1="0" x2="0" y2="30" stroke="#1d4ed8" strokeWidth="6" strokeLinecap="round" />
        <g
          className="rk-part"
          style={{ transform: `translate(0px, 30px) rotate(${pose.wrist}deg)`, transformOrigin: '0px 0px' }}
        >
          {pose.open > 0
            ? <path d="M -8 0 L -6 10 M -3 0 L -2 12 M 0 0 L 0 13 M 3 0 L 2 12 M 8 0 L 6 10"
                    stroke="#1e3a8a" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            : <circle cx="0" cy="5" r="7" fill="#1e3a8a" />
          }
        </g>
      </g>
    </g>
  )
}

function Leg({ side, pose }) {
  const sign = side === 'left' ? -1 : 1
  const hipX = sign * 12
  const hipY = -2
  return (
    <g
      className="rk-part rk-leg"
      style={{
        transform: `translate(${hipX}px, ${hipY}px) rotate(${sign * pose.out + pose.hip}deg)`,
        transformOrigin: '0px 0px',
      }}
    >
      <line x1="0" y1="0" x2="0" y2="46" stroke="#111827" strokeWidth="9" strokeLinecap="round" />
      <circle cx="0" cy="0" r="5" fill="#374151" />
      <g
        className="rk-part"
        style={{ transform: `translate(0px, 46px) rotate(${pose.knee}deg)`, transformOrigin: '0px 0px' }}
      >
        <line x1="0" y1="0" x2="0" y2="42" stroke="#111827" strokeWidth="8" strokeLinecap="round" />
        <rect x="-10" y="42" width="22" height="7" rx="2" fill="#1c1c1a" />
      </g>
    </g>
  )
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)) }
