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
  { type: 'Repeat',       container: true,  params: { times: 3 } },
  { type: 'WaitUntil',    container: false, params: { condition: 'sensor == true' } },
  { type: 'StopUntil',    container: false, params: { condition: 'sensor == true' } },
  { type: 'Break',        container: false, params: {} },
  { type: 'Continue',     container: false, params: {} },
  { type: 'Pass',         container: false, params: {} },
  { type: 'If',           container: true,  params: { condition: 'x > 0' } },
  { type: 'ElseIf',       container: true,  params: { condition: 'x == 0' } },
  { type: 'Else',         container: true,  params: {} },
  { type: 'While',        container: true,  params: { condition: 'x > 0' } },
  { type: 'For',          container: true,  params: { iterator: 'i', from: 0, to: 10 } },
]

export const PARAM_RANGES = {
  time:   { min: 1, max: 999, step: 1,  suffix: 's'  },
  speed:  { min: 0, max: 100, step: 1,  suffix: '%'  },
  degree: { min: 0, max: 180, step: 1,  suffix: '°'  },
}

export const DIRECTIONS = ['Forward', 'Backward', 'Left', 'Right']
