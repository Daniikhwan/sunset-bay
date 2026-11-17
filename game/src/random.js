// A small seeded random source (splitmix32): the same seed stages the same
// city, the same traffic and the same screenshot scenes, so ?shot= is
// repeatable. The state is one 32-bit word, advanced by a fixed odd constant.

export function createRandom(seed) {
  let word = (seed | 0) >>> 0;
  function next() {
    word = (word + 0x9e3779b9) >>> 0;
    let z = word;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
    return ((z ^ (z >>> 15)) >>> 0) / 4294967296;
  }
  return next;
}

/** A float in [low, high). */
export function range(rng, low, high) {
  return low + rng() * (high - low);
}

/** An integer in [low, high] inclusive. */
export function int(rng, low, high) {
  return low + Math.floor(rng() * (high - low + 1));
}

/** One element of an array, uniformly. */
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** True with the given probability. */
export function chance(rng, p) {
  return rng() < p;
}
