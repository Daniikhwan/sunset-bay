# Sunset Bay

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Daniikhwan/sunset-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Daniikhwan/sunset-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Sunset Bay** is a complete open-world crime game that runs offline in a
desktop browser. The sun is going down over a coastal city; you are a driver
for hire with a fixer named Marla, a police department that never sleeps, and
a whole grid of avenues to make your own. Jack a car off the street, build a
wanted level star by star, and run the four jobs Marla lines up — a package
for the docks, a getaway to the hideout, a plaza full of rivals, and the bank
job that could set you up for good.

What is in the game:

- A full 3D city to explore on foot and behind the wheel, built in Three.js
- Carjacking: take parked cars, or pull drivers out of moving traffic (E)
- A 0–5 star wanted system with cop cars that chase and ram, and foot cops
  who close in to make the bust
- Four story missions in order, with a gold beacon, a clock and a payout
- Fists and a pistol, with rivals who shoot back at the plaza
- A HUD with wanted stars, health, cash, speed and a live minimap
- Sound made from scratch with WebAudio — engine, sirens, gunfire, jingles
- Progress that saves in your browser, and repeatable screenshot scenes

## Playing it

No build step and no network at runtime. Start the static server and open
the game in desktop Chrome:

```sh
node serve.ts
```

Then visit <http://localhost:8080> and press ENTER (or click START ENGINE).
Everything the game loads is a local file under `game/`.

## How to play

- **WASD / mouse** — move on foot, drive, and look around (click to lock the mouse)
- **Shift** — sprint
- **E** — get in or out of a car
- **M** — start the current job
- **Q** — draw or holster the pistol
- **Click** — shoot while the pistol is out
- **F** — punch
- **R** — reload
- **P** — pause

---

This entry is in the [Make GTA 6](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
competition on make.fun — play it there via [this referral link](https://make.fun/?ref=vnsny7za&utm_source=github&utm_medium=readme&utm_campaign=gta6-01).
