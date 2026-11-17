// Sunset Bay — shared tuning constants, the seeded random helper, and the
// mission table. Everything here is plain data: no scene, no DOM, no audio.
export const CFG = {
  // City layout: roads run on a 40-unit grid, blocks are 40x40.
  grid: 40,
  roadHalf: 6,
  cityHalf: 200,
  // Beach and sea sit east of the city (positive X).
  beachX: 208,
  seaX: 236,
  // Player on foot.
  walkSpeed: 6.5,
  runSpeed: 11,
  playerRadius: 0.9,
  // Driving.
  carAccel: 26,
  carBrake: 42,
  carMaxSpeed: 40,
  carReverseMax: 13,
  carSteer: 2.1,
  carGrip: 3.2,
  // Wanted / police.
  maxWanted: 5,
  wantedDecaySeconds: 18,
  copChaseSpeed: 34,
  copRamDamage: 6,
  // Combat.
  pistolDamage: 34,
  punchDamage: 34,
  punchRange: 2.6,
  pistolRange: 90,
  startAmmo: 36,
  enemyHealth: 100,
  // Missions.
  hideout: { x: -160, z: 160 },
  bank: { x: -120, z: -60 },
  plaza: { x: 60, z: 120 },
  delivery: { x: 150, z: -150 },
  spawn: { x: 0, z: 24 },
};

// Deterministic seeded random (mulberry32). Used for the city layout and for
// the screenshot scenes so the same seed always builds the same Sunset Bay.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function range(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

// The four missions Marla hands out, in order. `target` is the beacon's
// position, `timeLimit` seconds (0 = no clock), `reward` dollars.
export const MISSIONS = [
  {
    id: 1,
    name: 'The Package',
    brief:
      "Marla: 'Sunset Bay, baby. A package needs to reach the north docks — fast, quiet, no questions. Take any car you like. The clock is already running.'",
    objective: 'Deliver the package to the docks beacon',
    target: { x: 150, z: -150 },
    timeLimit: 120,
    reward: 500,
  },
  {
    id: 2,
    name: 'Hot Wheels',
    brief:
      "Marla: 'The heat is on you now. Lose the cruisers and get to the hideout on the west edge. Do not stop. Do not get caught.'",
    objective: 'Escape the police — reach the hideout',
    target: { x: -160, z: 160 },
    timeLimit: 150,
    reward: 800,
  },
  {
    id: 3,
    name: 'Turf War',
    brief:
      "Marla: 'Rivals moved into the plaza and they carry guns. Clear all three of them out. Punch or pistol — your call, but make it count.'",
    objective: 'Defeat the 3 armed rivals at the plaza',
    target: { x: 60, z: 120 },
    timeLimit: 0,
    reward: 1200,
  },
  {
    id: 4,
    name: 'The Bank Job',
    brief:
      "Marla: 'Last one. Grab the cash at the Bay Bank, then run for the hideout with every cruiser in the city on your tail. We retire after this.'",
    objective: 'Grab the bank cash, then reach the hideout',
    target: { x: -120, z: -60 },
    timeLimit: 0,
    reward: 2500,
  },
];

export const DIALOG_LINES = {
  missionDone:
    "Marla: 'Clean work. The money is yours — next job is on the board when you are ready.'",
  busted: "The Sunset Bay PD has you. The run ends here — for now.",
  wasted: 'Sunset Bay chewed you up. Get patched up and come back swinging.',
  steal: "You jacked a ride. The city noticed.",
  pickup: 'Picked up. Nice.',
};
