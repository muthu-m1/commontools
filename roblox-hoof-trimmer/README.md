# 🐴 Hoof Trimmer (Roblox)

A satisfying hoof-trimming game inspired by the "Satisfying hoof trim!" clip: pick the packed dirt out,
reveal the frog, peel the chalky sole, snip the wall and rasp it smooth — without hurting the horse.

## Run it

1. Install [Rojo](https://rojo.space) and the Rojo Studio plugin.
2. `cd roblox-hoof-trimmer && rojo serve`, then connect from Studio (or `rojo build -o HoofTrimmer.rbxlx`).
3. Press Play. For saving to work in Studio, enable *Game Settings → Security → Enable Studio Access to API Services*.

## How to play

| Tool (key) | Does |
|---|---|
| ⛏ Hoof Pick (1) | Scrub away dirt. Everything else is blocked until the area is clean. |
| 🔪 Hoof Knife (2) | Peel frog flaps and chalky sole (they turn tan / white). Cutting spots that are already clean hurts the horse. |
| ✂ Nippers (3) | Click to snip overgrown wall (dark rim). |
| 📏 Rasp (4) | Smooths the rough spots left after cutting. Also trims overgrowth, very slowly, but never hurts. |
| 🧴 Dressing (5) | Paint cleaned thrush (black patches) with dressing. |

Hold and drag with the mouse / finger to work. **E** (or the button) pats the horse: restores comfort and
calms a restless horse if you do it during the warning. When the horse *shifts*, lift your tool — working during
the kick costs comfort. If comfort hits 0 the horse pulls its foot away.

**Stars:** 1 = finished (≥92%), 2 = ≥98% clean with comfort ≥50, 3 = ≥99.5% clean, comfort ≥75 and under par time.
Coins buy upgrades in the shop (faster pick/knife/rasp, wider nippers, stronger treats).

10 levels ramp up dirt, overgrowth, thrush, pain sensitivity and flinch frequency.

## Layout

- `src/shared/Config.lua` – tools, upgrades, all level tuning (edit this to add levels).
- `src/shared/HoofSim.lua` – hoof generation, tool logic, flinches, grading (pure Lua, no Roblox APIs).
- `src/server/GameServer.server.lua` – DataStore saving, shop, level-result validation.
- `src/client/` – UI (`Main.client.lua`), hoof renderer (`HoofView.lua`), UI helpers (`Ui.lua`).

## Tests

The simulation is plain Lua: `pip install lupa && python3 tests/run_tests.py` checks that every level is
completable, precise play keeps the horse comfortable, flinches/pats/grading behave, and generation is deterministic.

## Notes

Gameplay runs on the client; the server owns coins/unlocks/upgrades and re-grades submissions with basic sanity
checks (not full anti-cheat). Sound effects use built-in `rbxasset://sounds/` clips; swap in your own asset IDs in `Main.client.lua`.
