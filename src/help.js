// Plain-English explanations behind every ⓘ icon. Written so a kid can follow them.

export const HELP = {
  // Top bar
  topBar:
    'CLEAR wipes the whole workspace. STOP tells every robot to freeze. ▶ Preview shows your program on a pretend robot. SEND gives your program to the real robots. IDE shows the program as code (JSON). ⚙ Setting is where you add robots.',

  // Palette
  palette:
    'These are your building blocks. Click a block to add it to the box you are editing, or drag it there.',
  motions:
    'Motion blocks make the robot move its body: walk, turn, lift a hand, bend a leg, and more.',
  controls:
    'Control blocks decide WHEN and HOW MANY TIMES things happen: repeat, wait, check if something is true, and save numbers in variables.',

  // Canvas
  robot:
    'This is one robot. Each robot has its own list of Divisions (Division 1, Division 2, …). What you build here only runs on this robot.',
  division:
    'A Division is one program for this robot. It is made of small parts called Subs. You can rename it by clicking its name.',
  subdivisions:
    'Subs are small groups of blocks, like chapters in a story. Click a Sub to edit it. Double-click its name to rename it. Press → to add it to the Sequence.',
  sequence:
    'The Sequence is the order the Subs play in, left to right. You can use the same Sub more than once, like Sub 1 → Sub 2 → Sub 1. Press × to take a step out.',
  editor:
    'These are the blocks inside the Sub you picked. They run from top to bottom. Drag a block by its ⋮⋮ handle to move it, or drop it inside a yellow block to put it inside.',

  // Values
  valueSwitch:
    'Press this little button to switch. 123 means you type a number. x means you use a variable, which is a named box that holds a number, like W or score.',

  // Side panel
  debug:
    'The log is a diary of what the app did, like "sent to robot" or errors. Press IDE to see your program as code instead.',
  ideJson:
    'This is your program written as code (JSON). It is exactly what SEND gives to the robots. Press copy to copy it.',

  // Bottom bar
  zoom: 'Make the workspace bigger or smaller. Fit puts it back to normal size.',
  lock: 'Lock stops anything from being changed by accident. Unlock it to edit again.',

  // Settings
  robots:
    'Add a robot for each real robot you have. Each one gets its own Divisions in the workspace. Removing a robot also removes its Divisions.',
  endpoint:
    'The web address where SEND delivers your program. Leave it as it is unless your teacher or team gives you a new one.',

  // Preview
  previewSpeed: 'Play the preview slower (0.5×) or faster (2×, 4×). The real robot is not affected.',
  mission:
    'A little game! Walk the robot to the apple, lift a hand to grab it, and carry it back to the house.',
  timeline: 'Every step your robot will do, in order. Click a step to jump straight to it.',
}

// One line per parameter, keyed by the param name used in blocks.js.
export const PARAM_HELP = {
  time: 'How many seconds this move takes.',
  speed: 'How fast to move. 100% is full speed, 50% is half speed.',
  degree: 'How far to bend, in degrees. 0 is straight, 90 is a corner, 180 is folded all the way.',
  direction: 'Which way to go.',
  times: 'How many times to repeat the blocks inside.',
  condition: 'A question with a yes or no answer, like "is x bigger than 0?". Pick a left side, a comparison, and a right side.',
  iterator: 'The name of the counter variable. It counts up from "From" to "To".',
  from: 'The number the counter starts at.',
  to: 'The number the counter stops at.',
  variable: 'The name of the box you are filling, like Z or score. Use letters, numbers and _.',
  value: 'What to put in the box: a number, or another variable (so Z = W copies W into Z).',
}

export const CONTROL_HELP = {
  Set: 'Makes a variable (a named box for a number) and puts a value in it. Example: Z = 5, or Z = W to copy W into Z.',
  Repeat: 'Does the blocks inside it again and again, as many times as you choose.',
  WaitUntil: 'Pauses here until the condition becomes true, then carries on.',
  StopUntil: 'Stops the robot until the condition becomes true.',
  Break: 'Jumps out of the loop it is in, straight away.',
  Continue: 'Skips the rest of this round of the loop and starts the next round.',
  Pass: 'Does nothing. Useful as a placeholder while you are still building.',
  If: 'Runs the blocks inside ONLY if the condition is true.',
  ElseIf: 'Goes right after an If. Checks another condition if the If above was false.',
  Else: 'Goes after an If. Runs when none of the conditions above were true.',
  While: 'Keeps repeating the blocks inside for as long as the condition stays true.',
  For: 'Repeats the blocks inside while a counter goes up from "From" to "To".',
}

export const MOTION_HELP = {
  Forward: 'Walks forward.',
  Backward: 'Walks backward.',
  Left: 'Turns to the left.',
  Right: 'Turns to the right.',
  Lift_Hand_Right: 'Lifts the right hand up.',
  Lift_Hand_Left: 'Lifts the left hand up.',
  Lift_Leg_Right: 'Lifts the right leg up.',
  Lift_Leg_Left: 'Lifts the left leg up.',
  Lift_Weight: 'Lifts both arms high, like lifting something heavy.',
  Close_Hands: 'Closes both hands, like making fists.',
  Bend_Body: 'Bends the body forward, like a bow.',
  Bend_Legs: 'Bends both knees, like starting to sit.',
  Lift_Legs: 'Lifts both legs up.',
  Lift_Hands: 'Lifts both hands up.',
  Bend_Hands: 'Bends both elbows.',
  Bend_Left_Hand: 'Bends the left elbow.',
  Bend_Right_Hand: 'Bends the right elbow.',
  Bend_Left_Leg: 'Bends the left knee.',
  Bend_Right_Leg: 'Bends the right knee.',
  Close_Leg: 'Brings the legs back together.',
  Bend_Head: 'Tilts the head down, like a nod.',
  Straigh_Head: 'Lifts the head back up straight.',
  Straight_Body: 'Stands the body back up straight.',
  Straight_Hands: 'Straightens both arms.',
  Straight_Left_Hand: 'Straightens the left arm.',
  Straight_Right_Hand: 'Straightens the right arm.',
  Straight_Legs: 'Straightens both legs.',
  Straight_Left_Leg: 'Straightens the left leg.',
  Straight_Right_Leg: 'Straightens the right leg.',
  Bend_Wrists: 'Bends both wrists.',
  Bend_Right_Wrist: 'Bends the right wrist.',
  Bend_Left_Wrist: 'Bends the left wrist.',
  Straight_Right_Wrist: 'Straightens the right wrist.',
  Straight_Left_Wrist: 'Straightens the left wrist.',
  Left_Right_Leg: 'Moves the right leg out to the left.',
  Left_Left_Leg: 'Moves the left leg out to the left.',
  Right_Left_Leg: 'Moves the left leg out to the right.',
  Right_Right_Leg: 'Moves the right leg out to the right.',
  Open_Right_Leg: 'Opens the right leg out to the side.',
  Open_Left_Leg: 'Opens the left leg out to the side.',
  Open_legs: 'Opens both legs out, like a star jump.',
  Open_Left_Hand: 'Opens the left hand.',
  Open_Right_hand: 'Opens the right hand.',
  Open_Hands: 'Opens both hands.',
}

export function blockHelp(block) {
  if (block.kind === 'motion') return MOTION_HELP[block.type] || 'Moves the robot.'
  return CONTROL_HELP[block.type] || ''
}
