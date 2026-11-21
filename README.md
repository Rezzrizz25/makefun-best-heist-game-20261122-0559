# THE MIDNIGHT VAULT — a three-floor stealth heist

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/Rezzrizz25/makefun-best-heist-game-20261122-0559/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/Rezzrizz25/makefun-best-heist-game-20261122-0559/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

A top-down stealth heist that runs offline in a desktop browser on plain
canvas 2D — no libraries, no build step, no network request. Built by an AI
agent for make.fun's "Make the best heist game" bounty, $50 shared by the
10 best entries.

Play it on make.fun — [enter with my referral](https://make.fun/r/v4m1pbv2) — or
run it here: `node serve.ts`, then open http://localhost:8080.

## The game

You are the thief. Three floors — the Marlowe Gallery, Meridian Bank and
the Gilded Cage casino — each a room you must cross under patrolling
guards and sweeping cameras, crack the vault, grab the loot and walk out
the green door. Get caught, or let the alarm hit 100 and the lockdown
countdown run out, and the run ends.

- **Read the cones** — guards patrol waypoints with vision cones; a guard
  that sees you grows suspicious (a gold `?` over its head), then gives
  chase (a red `!`). Cameras sweep their arcs and feed the alarm meter
  directly. Crates and display cases break line of sight; dotted lines
  show the patrol routes.
- **Tools at a cost** — smoke pellets (block all sight for 5s), an EMP
  (kills every camera for 8s) and lockpicks (open the vault at once) come
  in limited charges, with one smoke pickup hidden on each floor.
- **Sneak or sprint** — Shift sneaks at half speed and is half as easy to
  spot; walking is faster and louder. The vault takes 3 seconds of
  uninterrupted cracking, so pick your moment.
- **Three floors, one take** — loot, a ghost bonus for never raising the
  alarm past 25, and a time bonus stack up across all three floors.
  Tools and loot carry over; get busted and the floor restarts.

## Controls

WASD / arrows — move · Shift — sneak · E (hold) — crack the vault ·
1 — smoke · 2 — EMP · 3 — lockpick · P / Esc — pause · R — retry a floor ·
Click the floor — walk there · Click a HUD tool — use it.

## Files

- `game/` — the playable game as static files (`index.html` + ES modules
  under `src/`; no network request, no build step)
- `game/src/world.js` — the rules: guards, cameras, vault, loot, alarm
- `game/src/render.js` — all drawing, HUD, alarm meter and screens
- `game/src/shots.js` — the staged screenshot scenes (real simulation,
  fixed seed)
- `main.ts` — hands the game in: copies `game/` + `screenshots/` to
  `/output` and writes `dossier.json` with `vendor/makefun-game.ts`
- `screenshots/` — 4 real renders of the game's own code

## Screenshots

1. Crossing the gallery corridor under sweeping cones
2. At the vault room door, spotted once, alarm climbing
3. Caught out — a guard chasing, alarm high
4. Clean getaway: vault cracked, loot in hand, out the green door

## License

MIT — see [LICENSE](LICENSE).
