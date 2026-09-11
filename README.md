# Holdfast — Sector K

Bare-bones browser FPS homage to late-90s N64 corridor shooters.

**Unofficial fan homage.** Not affiliated with Nintendo, Rare, or any related trademarks. Original facility names and art only.

## Play

```bash
cd facility-fps
python3 -m http.server 8080
```

Open `http://localhost:8080`, click **CLICK TO START**.

Also fine on GitHub Pages (serve this folder as the site root).

## Controls

| Input | Action |
|-------|--------|
| W A S D | Move |
| Mouse | Look (pointer lock) |
| LMB | Fire |
| R | Reload |
| 1 / 2 | Pistol / SMG |
| Space | Jump |
| Esc | Release pointer lock |

## Objective

Spawn in the Sector K corridor, clear the guards, reach the teal exit hatch for **OBJECTIVE COMPLETE**.

## Stack

- Three.js (CDN, ES modules)
- Vanilla JS — no npm build

## Known limits

- Simple AABB collision (no stairs/ramps)
- Guards use cone aggro + inaccurate hitscan (intentionally dumb)
- Desktop first; mobile / touch not implemented
- One map only (v1 ship bar)
