// The Midnight Vault — tuning, palette and the three heist floors.
// The playfield is a fixed 1280x720 logical area (32x18 tiles of 40px); the
// renderer scales it to the window, so no rule depends on the screen size.
// Maps are strings: '#' wall, '.' floor, ',' carpet, 'X' crate (cover),
// 'D' display case (cover), 'T' thief start, 'E' getaway door, 'V' vault,
// 'L' side loot, 'S' smoke pickup, 'G' guard marker (floor).
// The floors are three vertical rooms joined by one open corridor; each room
// has a single door, so every approach is a choice of route, not a maze.

export const FIELD = { width: 1280, height: 720 };
export const TILE = 40;
export const STEP = 1 / 60;

export const THIEF = {
  radius: 13,
  walkSpeed: 205,
  sneakSpeed: 105,
  grabRadius: 26,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 78,
  chaseSpeed: 168,
  viewRange: 235,
  viewHalfAngle: 0.56, // ~32 degrees each side
  suspicionRate: 0.85, // per second at point blank, scaled by distance
  suspicionDecay: 0.22,
  pauseAtWaypoint: 1.1,
};

export const CAMERA = {
  range: 265,
  halfAngle: 0.44,
  sweepSpeed: 0.55, // radians per second
  sweepArc: 1.15, // radians each side of its base angle
  alarmRate: 11, // alarm points per second while it sees the thief
};

export const ALARM = {
  guardRate: 7, // per second while any guard is suspicious (> 0.5)
  alertRate: 13, // per second while any guard is fully alerted
  decay: 2.2, // per second while nobody sees the thief
  lockdownSeconds: 20, // countdown once the alarm hits 100
};

export const VAULT = { crackSeconds: 3.0, lockpickSeconds: 0.0 };
export const TOOLS = { smoke: 2, emp: 1, lockpick: 1 };
export const SMOKE = { radius: 95, seconds: 5 };
export const EMP = { seconds: 8 };

export const LOOT = {
  vault: 5000,
  side: 800,
  ghostBonus: 500, // alarm never passed 25 all level
  timeBonusPerSecond: 12, // leftover seconds under par, capped
};

export const PALETTE = {
  floorA: '#20242e',
  floorB: '#1b1f28',
  carpet: '#5d2430',
  carpetEdge: '#7a2f3d',
  wall: '#0e1016',
  wallTop: '#3a4152',
  crate: '#6b4a2a',
  crateTop: '#8a6238',
  caseGlass: '#3f6d8e',
  caseBase: '#232a36',
  vaultDoor: '#c9a227',
  vaultGlow: '#f2c94c',
  exitDoor: '#2fae5f',
  thief: '#e8e4d8',
  thiefHood: '#23232e',
  guard: '#33507e',
  guardAlert: '#c0392b',
  coneCalm: 'rgba(242, 201, 76, 0.16)',
  coneSuspicious: 'rgba(242, 166, 52, 0.30)',
  coneAlert: 'rgba(224, 57, 43, 0.34)',
  coneCamera: 'rgba(86, 156, 214, 0.16)',
  text: '#eef1f5',
  muted: '#9aa3b2',
  gold: '#f2c94c',
  red: '#e0392b',
  green: '#2fae5f',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const BEST_KEY = 'midnight-vault.best';

/**
 * One floor of the heist. `guards` are patrols: a list of tile waypoints the
 * guard walks in order, pausing at each. `cameras` watch a sweep: base angle
 * in radians (0 = east, PI/2 = south) plus a sweep arc either side of it.
 * `par` is the target time in seconds for the time bonus.
 */
export const LEVELS = [
  {
    name: '1 · The Marlowe Gallery',
    sub: 'Lift the Star Sapphire from the south-east vault',
    par: 150,
    map: [
      '################################',
      '#E....#.....,......#...........#',
      '#.....#.....,......#.....L.....#',
      '#..X..#.....,......#...........#',
      '#....D#.....,......#......X....#',
      '#.....#.....,......#...........#',
      '#.....#.....,......#...........#',
      '###.####...,...,...####.########',
      '#......,....,....,....,....,...#',
      '#...G..,....,....,....,....G...#',
      '#......,....,....,....,....,...#',
      '###.####...,...,...####.########',
      '#.....#.....,......#...........#',
      '#..X..#.....,......#......X....#',
      '#....D#.....,......#...........#',
      '#.T...#.....,......#........V..#',
      '#.....#.....,......#......S....#',
      '################################',
    ],
    guards: [
      { waypoints: [[4, 9], [14, 9], [14, 8], [4, 8]] },
      { waypoints: [[27, 9], [18, 9], [18, 10], [27, 10]] },
    ],
    cameras: [
      { tx: 24, ty: 13, angle: Math.PI / 2, arc: 1.0 },
      { tx: 7, ty: 16, angle: -Math.PI / 2, arc: 0.9 },
    ],
  },
  {
    name: '2 · Meridian Bank',
    sub: 'Crack the main vault — three patrols, three eyes',
    par: 180,
    map: [
      '################################',
      '#E....#.....,......#....L......#',
      '#..X..#.....,......#...........#',
      '#....D#.....,......#......X....#',
      '#.....#.....,......#...........#',
      '###.####...,...,...####.########',
      '#......,....,....,....,....,...#',
      '#...G..,....,....,....,....G...#',
      '#......,....,....,....,....,...#',
      '#......,....,....,....,....,...#',
      '###.####...,...,...####.########',
      '#.....#.....,......#...........#',
      '#..X..#.....,......#......X....#',
      '#....D#.....,......#...........#',
      '#.T...#.....,......#........V..#',
      '#.....#.....,......#.....L.....#',
      '#.....#.....,......#...........#',
      '################################',
    ],
    guards: [
      { waypoints: [[4, 7], [13, 7], [13, 9], [4, 9]] },
      { waypoints: [[27, 7], [18, 7], [18, 9], [27, 9]] },
      { waypoints: [[15, 1], [15, 4], [16, 4], [16, 1]] },
    ],
    cameras: [
      { tx: 24, ty: 1, angle: Math.PI / 2, arc: 1.1 },
      { tx: 7, ty: 16, angle: -Math.PI / 2, arc: 0.9 },
      { tx: 15, ty: 5, angle: Math.PI / 2, arc: 1.2 },
    ],
  },
  {
    name: '3 · The Gilded Cage',
    sub: 'The casino vault. Nobody walks out slow.',
    par: 210,
    map: [
      '################################',
      '#E....#.....,......#......L....#',
      '#.....#.....,......#.....X.....#',
      '#..G..#.....,......#.....L.....#',
      '#.....#.....,......#...........#',
      '###.####...,...,...####.########',
      '#...G..,....,....,....,....,...#',
      '#......,....,....,....,....,...#',
      '#......,....,....,....,....,G..#',
      '#......,....,....,....,....,...#',
      '###.####...,...,...####.########',
      '#.....#.....,......#...........#',
      '#..X..#.....,......#......X....#',
      '#..G..#.....,......#........V..#',
      '#....D#.....,......#...........#',
      '#.T...#.....,......#.....L.....#',
      '#.....#.....,......#...........#',
      '################################',
    ],
    guards: [
      { waypoints: [[4, 6], [13, 6], [13, 8], [4, 8]] },
      { waypoints: [[28, 8], [19, 8], [19, 6], [28, 6]] },
      { waypoints: [[3, 3], [4, 3], [4, 4], [3, 4]] },
      { waypoints: [[15, 1], [15, 4], [16, 4], [16, 1]] },
    ],
    cameras: [
      { tx: 24, ty: 1, angle: Math.PI / 2, arc: 1.1 },
      { tx: 7, ty: 16, angle: -Math.PI / 2, arc: 0.9 },
      { tx: 15, ty: 5, angle: Math.PI / 2, arc: 1.2 },
      { tx: 27, ty: 13, angle: Math.PI, arc: 1.0 },
    ],
  },
];
