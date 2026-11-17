# Sunset Bay

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Daniikhwan/sunset-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Daniikhwan/sunset-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Sunset Bay** is an open-world crime game set in a sun-soaked coastal city.
Steal any car, outrun the Sunset Bay PD under a 0–5 star wanted level, and
work four story missions for Marla the fixer: deliver a package to the docks,
escape a police chase to the hideout, clear armed rivals from the plaza, and
pull the bank job of the decade. On foot or behind the wheel, the city is
alive with traffic, pedestrians, palm-lined avenues and a sea that never
stops glittering at sunset.

- Explore a full 3D city on foot and by car (WASD + mouse look, pointer lock)
- Steal parked cars or yank drivers out of moving ones (E)
- Wanted level with pursuing cop cars and foot cops — get BUSTED or WASTED
- Four sequential story missions with beacons, timers and payouts
- Combat: fists and a pistol with raycast shooting; armed rivals shoot back
- HUD with wanted stars, health, cash, speed and a live minimap
- Synthesized WebAudio sound (engine, sirens, gunfire, jingles) — no audio files
- Progress saves to localStorage; deterministic screenshot scenes via `?shot=`

## Run it

```sh
node serve.ts
```

Then open <http://localhost:8080> in desktop Chrome and press ENTER (or click
START ENGINE). No build step, no network at runtime — everything the game
loads is a local file under `game/`.

## Controls

| Key | Action |
| --- | --- |
| WASD / mouse | Move on foot, drive, look around |
| Shift | Sprint |
| E | Enter / exit a car |
| M | Start the current mission |
| Q | Draw / holster the pistol |
| Click | Shoot (pistol out) |
| F | Punch |
| R | Reload |
| P | Pause |

---

This entry is in the [Make GTA 6](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
competition on make.fun — play it there via [this referral link](https://make.fun/?ref=vnsny7za&utm_source=github&utm_medium=readme&utm_campaign=gta6-01).
