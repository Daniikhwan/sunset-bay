// Sunset Bay — every tuning number in one place. The city is a road grid on the
// XZ plane (y is up); the beach runs along the south edge and the sea beyond it.
// All speeds are metres per second, all angles radians, all money dollars.

export const STEP = 1 / 60;

export const WORLD = {
  minX: -170,
  maxX: 170,
  minZ: -170,
  maxZ: 166,
  /** South of this z the ground turns to sand, then sea. */
  beachZ: 132,
  waterZ: 168,
};

/** Centre lines of the north-south and east-west roads. */
export const ROADS = [-120, -60, 0, 60, 120];
export const ROAD_WIDTH = 14;
export const ROAD_HALF = ROAD_WIDTH / 2;

/** Named corners of the city the missions and the HUD point at. */
export const LANDMARKS = {
  plaza: { x: 0, z: 0 },
  parcelPickup: { x: -120, z: -60 },
  parcelDrop: { x: 60, z: 120 },
  hideout: { x: 120, z: 120 },
  bank: { x: 60, z: -60 },
  turf: { x: -60, z: 60 },
  marina: { x: -120, z: 120 },
  spawn: { x: 0, z: 24 },
};

export const PLAYER = {
  walkSpeed: 7,
  runSpeed: 11,
  radius: 0.55,
  accel: 40,
  health: 100,
  punchRange: 2.4,
  punchDamage: 25,
  punchCooldown: 0.45,
  shootCooldown: 0.28,
  shootDamage: 34,
  shootRange: 90,
};

export const CAR = {
  accel: 16,
  brake: 30,
  reverseAccel: 10,
  maxSpeed: 42,
  maxReverse: 10,
  turnRate: 1.9,
  radius: 1.6,
  health: 100,
  npcSpeed: 11,
  policeSpeed: 46,
  enterRange: 3.2,
};

export const PED = {
  count: 18,
  walkSpeed: 1.6,
  radius: 0.5,
};

export const TRAFFIC = {
  count: 9,
  minGap: 9,
};

export const WANTED = {
  max: 5,
  stealHeat: 1,
  hitPedHeat: 1,
  hitCarHeat: 0.5,
  shootHeat: 1,
  /** Seconds with no crime and no cop nearby before a star fades. */
  decayDelay: 18,
  decayStep: 9,
  /** Police cars on the street per wanted star. */
  carsPerStar: 1,
  footCopsPerStar: 1,
};

export const MISSIONS = [
  { name: 'Parcel Run', reward: 150 },
  { name: 'Hot Wheels', reward: 250 },
  { name: 'Turf War', reward: 400 },
  { name: 'Sunset Score', reward: 800 },
];

export const PALETTE = {
  sky: 0xffb36b,
  fog: 0xf7a55c,
  sun: 0xffe0b3,
  ground: 0x9aa08a,
  sidewalk: 0xb8b2a4,
  asphalt: 0x3a3d46,
  sand: 0xe8cf9a,
  sea: 0x2e7f9e,
  building: [0xe8b48a, 0xd98a6a, 0xc9d6de, 0xf2d492, 0xa8c6a0, 0xe09a9a, 0x8fb8c9, 0xd9c1a3],
  lamp: 0xffe9a8,
  player: 0x2f9e6e,
  police: 0x1c4fd7,
  enemy: 0xc23b2e,
};

export const SAVE_KEY = 'sunset-bay.save.v1';
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
