export function defaultPose() {
  return {
    x: 0, y: 0, bodyRot: 0,
    headTilt: 0,
    torsoTilt: 0,
    leftArm:  { shoulder: 0, elbow: 0, wrist: 0, open: 0 },
    rightArm: { shoulder: 0, elbow: 0, wrist: 0, open: 0 },
    leftLeg:  { hip: 0, knee: 0, out: 0 },
    rightLeg: { hip: 0, knee: 0, out: 0 },
    weight: 0,
  }
}

export function flattenSequence(division) {
  const steps = []
  for (const subId of division.sequence) {
    const sub = division.subdivisions.find(s => s.id === subId)
    if (!sub) continue
    walk(sub.blocks, sub.name, steps)
  }
  return steps
}

function walk(blocks, subName, out) {
  for (const b of blocks) {
    if (b.kind === 'motion') {
      out.push({ subName, kind: 'motion', block: b, label: b.type })
      continue
    }
    // control
    switch (b.type) {
      case 'Repeat': {
        const n = Math.max(1, Math.min(50, Number(b.params?.times) || 1))
        for (let i = 0; i < n; i++) walk(b.children || [], subName, out)
        break
      }
      case 'If':
      case 'ElseIf':
      case 'Else':
      case 'While':
      case 'For':
        out.push({ subName, kind: 'note', block: b, label: `${b.type}  (preview runs body once)` })
        walk(b.children || [], subName, out)
        break
      case 'WaitUntil':
      case 'StopUntil':
        out.push({ subName, kind: 'wait', block: b, label: `${b.type}: ${b.params?.condition || '…'}` })
        break
      default:
        out.push({ subName, kind: 'note', block: b, label: b.type })
    }
  }
}

export function applyBlock(pose, step) {
  const p = clone(pose)
  if (step.kind === 'wait') return p
  if (step.kind === 'note') return p

  const b = step.block
  const params = b.params || {}
  const speed = clampNum(params.speed, 0, 100, 100)
  const time  = clampNum(params.time,  1, 999, 1)
  const deg = clampNum(params.degree, 0, 180, 90)
  const dir = params.direction || 'Forward'
  const stride = Math.max(15, Math.min(150, (speed / 100) * (30 + 20 * time)))

  switch (b.type) {
    case 'Forward':
      if (dir === 'Backward') p.x -= stride
      else if (dir === 'Left')  p.x -= stride * 0.6
      else if (dir === 'Right') p.x += stride * 0.6
      else p.x += stride
      break
    case 'Backward': p.x -= stride; break
    case 'Left':     p.bodyRot -= 30 * (speed / 100 || 0.5); break
    case 'Right':    p.bodyRot += 30 * (speed / 100 || 0.5); break

    case 'Lift_Hand_Right': p.rightArm.shoulder = -150; break
    case 'Lift_Hand_Left':  p.leftArm.shoulder  =  150; break
    case 'Lift_Hands':
      p.leftArm.shoulder = 150; p.rightArm.shoulder = -150; break
    case 'Lift_Leg_Right': p.rightLeg.hip = -70; break
    case 'Lift_Leg_Left':  p.leftLeg.hip  =  70; break
    case 'Lift_Legs':
      p.leftLeg.hip = 40; p.rightLeg.hip = -40;
      p.leftLeg.knee = 60; p.rightLeg.knee = 60; break
    case 'Lift_Weight':
      p.leftArm.shoulder = 160; p.rightArm.shoulder = -160; p.weight = 1; break

    case 'Bend_Body':  p.torsoTilt = deg / 3; break
    case 'Bend_Head':  p.headTilt  = deg / 3; break
    case 'Bend_Legs':  p.leftLeg.knee = deg; p.rightLeg.knee = deg; break
    case 'Bend_Hands': p.leftArm.elbow = deg; p.rightArm.elbow = -deg; break
    case 'Bend_Left_Hand':  p.leftArm.elbow  =  deg; break
    case 'Bend_Right_Hand': p.rightArm.elbow = -deg; break
    case 'Bend_Left_Leg':   p.leftLeg.knee   =  deg; break
    case 'Bend_Right_Leg':  p.rightLeg.knee  =  deg; break
    case 'Bend_Wrists':
      p.leftArm.wrist = deg / 2; p.rightArm.wrist = -deg / 2; break
    case 'Bend_Right_Wrist': p.rightArm.wrist = -deg / 2; break
    case 'Bend_Left_Wrist':  p.leftArm.wrist  =  deg / 2; break

    case 'Straigh_Head': case 'Straight_Head': p.headTilt = 0; break
    case 'Straight_Body':  p.torsoTilt = 0; break
    case 'Straight_Hands':
      p.leftArm.shoulder = 0; p.leftArm.elbow = 0; p.leftArm.wrist = 0;
      p.rightArm.shoulder = 0; p.rightArm.elbow = 0; p.rightArm.wrist = 0;
      break
    case 'Straight_Left_Hand':
      p.leftArm.shoulder = 0; p.leftArm.elbow = 0; p.leftArm.wrist = 0; break
    case 'Straight_Right_Hand':
      p.rightArm.shoulder = 0; p.rightArm.elbow = 0; p.rightArm.wrist = 0; break
    case 'Straight_Legs':
      p.leftLeg.hip = 0; p.leftLeg.knee = 0; p.leftLeg.out = 0;
      p.rightLeg.hip = 0; p.rightLeg.knee = 0; p.rightLeg.out = 0; break
    case 'Straight_Left_Leg':
      p.leftLeg.hip = 0; p.leftLeg.knee = 0; p.leftLeg.out = 0; break
    case 'Straight_Right_Leg':
      p.rightLeg.hip = 0; p.rightLeg.knee = 0; p.rightLeg.out = 0; break
    case 'Straight_Right_Wrist': p.rightArm.wrist = 0; break
    case 'Straight_Left_Wrist':  p.leftArm.wrist  = 0; break

    case 'Open_Left_Leg':  p.leftLeg.out  =  40; break
    case 'Open_Right_Leg': p.rightLeg.out = -40; break
    case 'Open_legs':
      p.leftLeg.out = 40; p.rightLeg.out = -40; break
    case 'Close_Leg':
      p.leftLeg.out = 0; p.rightLeg.out = 0; break
    case 'Left_Right_Leg':  p.rightLeg.out = -30; break
    case 'Left_Left_Leg':   p.leftLeg.out  = -20; break
    case 'Right_Left_Leg':  p.leftLeg.out  =  30; break
    case 'Right_Right_Leg': p.rightLeg.out =  20; break

    case 'Open_Left_Hand':  p.leftArm.open  = 1; break
    case 'Open_Right_hand':
    case 'Open_Right_Hand': p.rightArm.open = 1; break
    case 'Open_Hands':
      p.leftArm.open = 1; p.rightArm.open = 1; break
    case 'Close_Hands':
      p.leftArm.open = 0; p.rightArm.open = 0; break

    default: break
  }
  return p
}

export function stepDurationMs(step, multiplier = 1) {
  if (step.kind === 'note') return 450 / multiplier
  if (step.kind === 'wait') return 1400 / multiplier
  const t = Number(step.block.params?.time) || 1
  const raw = Math.max(500, Math.min(2500, t * 500))
  return raw / multiplier
}

function clone(x) { return JSON.parse(JSON.stringify(x)) }
function clampNum(v, min, max, def) {
  const n = Number(v)
  if (Number.isFinite(n)) return Math.max(min, Math.min(max, n))
  return def
}
