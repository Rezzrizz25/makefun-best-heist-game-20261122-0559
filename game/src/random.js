// A small seeded generator (mulberry32) so one seed always deals the same
// patrol timings, loot sparkles and guard pauses: the game is deterministic
// for a given seed, and the screenshots stage from a fixed seed.

export function createRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random integer in [min, max). */
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min));
}

/** Pick one element of an array. */
export function randomPick(random, items) {
  return items[Math.floor(random() * items.length)];
}
