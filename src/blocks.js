export const MOTION_BLOCKS = [
  'Forward', 'Backward', 'Left', 'Right',
  'Lift_Hand_Right', 'Lift_Hand_Left', 'Lift_Leg_Right', 'Lift_Leg_Left',
  'Lift_Weight', 'Close_Hands', 'Bend_Body', 'Bend_Legs',
  'Lift_Legs', 'Lift_Hands', 'Bend_Hands',
  'Bend_Left_Hand', 'Bend_Right_Hand', 'Bend_Left_Leg', 'Bend_Right_Leg',
  'Close_Leg', 'Bend_Head', 'Straigh_Head',
  'Straight_Body', 'Straight_Hands',
  'Straight_Left_Hand', 'Straight_Right_Hand',
  'Straight_Legs', 'Straight_Left_Leg', 'Straight_Right_Leg',
  'Bend_Wrists', 'Bend_Right_Wrist', 'Bend_Left_Wrist',
  'Straight_Right_Wrist', 'Straight_Left_Wrist',
  'Left_Right_Leg', 'Left_Left_Leg', 'Right_Left_Leg', 'Right_Right_Leg',
  'Open_Right_Leg', 'Open_Left_Leg', 'Open_legs',
  'Open_Left_Hand', 'Open_Right_hand', 'Open_Hands',
]

export function paramsForMotion(name) {
  const p = { time: 1, speed: 100 }
  if (/^Bend_|^Straigh/.test(name)) p.degree = 90
  if (/^(Forward|Backward|Left|Right)$/.test(name)) p.direction = 'Forward'
  return p
}

export const CONTROL_BLOCKS = [
  { type: 'Set',          container: false, params: { variable: 'x', value: 0 } },
  { type: 'Repeat',       container: true,  params: { times: 3 } },
  { type: 'WaitUntil',    container: false, params: { condition: { left: { var: 'sensor' }, op: '==', right: 1 } } },
  { type: 'StopUntil',    container: false, params: { condition: { left: { var: 'sensor' }, op: '==', right: 1 } } },
  { type: 'Break',        container: false, params: {} },
  { type: 'Continue',     container: false, params: {} },
  { type: 'Pass',         container: false, params: {} },
  { type: 'If',           container: true,  params: { condition: { left: { var: 'x' }, op: '>',  right: 0 } } },
  { type: 'ElseIf',       container: true,  params: { condition: { left: { var: 'x' }, op: '==', right: 0 } } },
  { type: 'Else',         container: true,  params: {} },
  { type: 'While',        container: true,  params: { condition: { left: { var: 'x' }, op: '>',  right: 0 } } },
  { type: 'For',          container: true,  params: { iterator: 'i', from: 0, to: 10 } },
]

export const PARAM_RANGES = {
  time:   { min: 1, max: 999, step: 1,  suffix: 's'  },
  speed:  { min: 0, max: 100, step: 1,  suffix: '%'  },
  degree: { min: 0, max: 180, step: 1,  suffix: '°'  },
}

export const DIRECTIONS = ['Forward', 'Backward', 'Left', 'Right']

export const OPERATORS = ['==', '!=', '>', '<', '>=', '<=']

// A value is either a plain number or { var: 'name' } pointing at a variable.
export const isVar = v => v != null && typeof v === 'object' && 'var' in v

export const cleanVarName = s => String(s).replace(/[^A-Za-z0-9_]/g, '').replace(/^[0-9]+/, '')

export function formatValue(v) {
  if (isVar(v)) return v.var || '?'
  return String(v ?? '')
}

export function formatCondition(c) {
  if (!c || typeof c !== 'object') return String(c ?? '')
  return `${formatValue(c.left)} ${c.op} ${formatValue(c.right)}`
}

// Older saves stored conditions as free text like "x > 0".
export function parseCondition(str) {
  const m = /^\s*(\S+?)\s*(==|!=|>=|<=|>|<)\s*(\S+)\s*$/.exec(String(str))
  if (!m) return { left: { var: 'x' }, op: '>', right: 0 }
  const side = t => {
    if (t === 'true') return 1
    if (t === 'false') return 0
    const n = Number(t)
    return Number.isFinite(n) ? n : { var: cleanVarName(t) }
  }
  return { left: side(m[1]), op: m[2], right: side(m[3]) }
}
