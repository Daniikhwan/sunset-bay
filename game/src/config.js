// Every tuning number for Sunset Bay in one place. The city is a grid of
// avenues: roads run along both axes at the coordinates in ROADS, blocks of
// buildings fill the squares between them, and the sea laps the southern
// edge. Nothing here depends on the window size or the frame rate.

/** Fixed simulation step, in seconds: 60 updates a second, whatever the display does. */
export const STEP = 1 / 60;

/** The city grid. Roads are centred on the coordinates in ROADS; a block is
 *  the square of buildings between two neighbouring roads. */
export const CITY = {
  pitch: 62,
  roadWidth: 14,
  block: 48,
  halfExtent: 155,
  beachStart: 155,
  seaStart: 176,
  seaEnd: 520,
};
export const ROADS = [-124, -62, 0, 62, 124];

/** Named places the missions and the HUD point at. Each one sits in the
 *  middle of a city block (block centres are at ±31 and ±93), never on a
 *  road, so the avenues stay clear to drive. */
export const PLACES = {
  hideout: { x: -31, z: -31, name: 'Hideout' },
  docks: { x: 138, z: 96, name: 'Docks' },
  plaza: { x: 31, z: 31, name: 'Plaza' },
  bank: { x: 31, z: -31, name: 'Bay Bank' },
  beach: { x: -40, z: 168, name: 'Sunset Beach' },
};

/** The player on foot. Speeds are metres per second. */
export const ON_FOOT = {
  walk: 6,
  sprint: 10.5,
  accel: 42,
  health: 100,
  punchRange: 2.4,
  punchDamage: 25,
  interactRange: 4.5,
};

/** Arcade car physics: no real suspension, just grip, drift and a handbrake feel. */
export const CAR = {
  accel: 24,
  brake: 34,
  reverseAccel: 14,
  maxSpeed: 38,
  maxReverse: 12,
  steerRate: 2.1,
  grip: 6.5,
  drag: 0.35,
  length: 4.6,
  width: 2.1,
};

/** The pistol: 12 rounds, a second to reload, infinite reserve. */
export const PISTOL = {
  magazine: 12,
  reloadSeconds: 1.1,
  damage: 34,
  range: 90,
  spread: 0.012,
};

/** Wanted level: 0 to 5 stars. Crimes add stars; quiet time sheds them. */
export const WANTED = {
  max: 5,
  stealCar: 1,
  shoot: 1,
  kill: 1,
  decaySeconds: 26,
  copCarsPerStar: 1,
  bustDistance: 3.2,
  bustSeconds: 1.6,
};

/** Traffic and pedestrians. */
export const TRAFFIC = {
  cars: 14,
  peds: 18,
  cruise: 11,
  cruiseJitter: 4,
};

/** The four story missions, in order. Marla the fixer hands them out. */
export const MISSIONS = [
  {
    id: 'package',
    name: 'Package Run',
    brief: 'Marla needs a package at the Docks. Drive there before the clock runs out.',
    target: PLACES.docks,
    radius: 10,
    timer: 75,
    payout: 500,
  },
  {
    id: 'pursuit',
    name: 'Hot Pursuit',
    brief: 'The cops are on you. Lose the heat and get to the Hideout in one piece.',
    target: PLACES.hideout,
    radius: 10,
    timer: 90,
    payout: 800,
    wanted: 3,
  },
  {
    id: 'plaza',
    name: 'Plaza Clearout',
    brief: 'Rivals hold the Plaza. Take all four of them down.',
    target: PLACES.plaza,
    radius: 26,
    timer: 0,
    payout: 1200,
    rivals: 4,
  },
  {
    id: 'bank',
    name: 'The Bank Job',
    brief: 'Hit Bay Bank, then lose a four-star tail and reach the Hideout.',
    target: PLACES.bank,
    radius: 10,
    timer: 0,
    payout: 2500,
    wanted: 4,
  },
];

/** Sunset palette: the whole city is lit warm, the sea cool. */
export const PALETTE = {
  skyTop: 0x2b1b4d,
  skyMid: 0xc65d7b,
  skyLow: 0xff9a5c,
  sun: 0xffd9a0,
  fog: 0xe08a6d,
  ground: 0x3a3f4a,
  road: 0x2c2f38,
  sidewalk: 0x6b6f7a,
  sand: 0xe0b98a,
  sea: 0x2a6f97,
  building: [0xe8dcc8, 0xd9a08c, 0x9fb8a8, 0xe0b48f, 0xc98a7a, 0xa8b8c8, 0xf0e0c0],
  windowLit: 0xffd27a,
  windowDark: 0x2a3242,
  palmTrunk: 0x7a5a3a,
  palmLeaf: 0x3f8f4f,
  car: [0xc0392b, 0x2980b9, 0xf39c12, 0x27ae60, 0x8e44ad, 0xecf0f1, 0x2c3e50, 0xe67e22],
  cop: 0x1a1a2e,
  copLight: 0x2244ff,
  copLight2: 0xff2222,
  player: 0x2ecc71,
  rival: 0x8e44ad,
  text: '#f5efe6',
  muted: '#c9b8a8',
  gold: '#f2c94c',
  red: '#e5534b',
};

/** Where progress is kept between visits (this browser only). */
export const SAVE_KEY = 'sunset-bay.save.v1';
