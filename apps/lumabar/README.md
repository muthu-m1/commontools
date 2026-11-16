# lumabar

A smart dock for Windows 11: live widgets in a glass bar that sits where the taskbar's empty space is.
Built with Electron. No accounts, no telemetry; the only network calls are the widgets you turn on.

## Run

```bash
cd apps/lumabar
npm install
npm start          # run the dock
npm test           # unit tests (no Electron needed)
npm run dist       # build a Windows installer + portable exe into dist/
```

`npm run dist` must be run on Windows (or CI with a Windows runner / Wine).

## Widgets

| Widget | Notes |
| --- | --- |
| Clock, Date, Calendar | Calendar opens a month view |
| Weather | [Open-Meteo](https://open-meteo.com), no key. Set your city in Settings. 5-day forecast in the panel |
| CPU, Memory, Storage, Battery | Live, with a usage meter |
| Pomodoro, Timer | Shared across windows; desktop notification when a session or countdown ends |
| To-dos, Notes | Saved locally |
| World clocks | Any IANA time zone, e.g. `London=Europe/London` |
| Crypto | [CoinGecko](https://www.coingecko.com) prices, no key |
| GitHub | Commits pushed today + followers for a public username |
| Pinned apps | Launcher icons for any `.exe` / `.lnk` |

Click a widget with a panel to open it. Click the gear (or the tray icon) for Settings: position (top/bottom),
layout (pill/full width), style (Glass, White, Midnight, Black), widget order, pinned apps and data sources.

## How it works

- `main.js`: dock + panel windows, tray, persistence (`%APPDATA%/lumabar/lumabar.json`), IPC.
- `appbar.js`: registers the dock as a Windows AppBar (via `koffi` → `SHAppBarMessage`) so maximised windows stop above it.
  Falls back to floating over the work area if unavailable. To use the dock instead of the taskbar, set the taskbar to auto-hide in Windows settings.
- `renderer/`: plain HTML/CSS/JS. `widgets.js` is the widget library; `dock.js` and `flyout.js` mount it.
- The glass effect is Windows 11's acrylic (`backgroundMaterial`), tinted by CSS.
- Security: sandboxed renderers with a strict CSP; the renderer can only reach a small preload API, and the fetch bridge is limited to an allowlist of HTTPS hosts (`logic.js`).

## Status / known gaps

Tested here: unit tests for the logic, and the renderer UI in Chromium with a mocked bridge.
**Not yet tested on a real Windows machine:** acrylic rendering, the AppBar space reservation, tray, notifications and launch-at-login.
Not built: now-playing, screen time, and per-service AI-limit / revenue widgets (they need API keys or OAuth).

## Build without a Windows PC

The repo has a GitHub Actions workflow (`.github/workflows/lumabar-build.yml`) that builds the installer and portable exe on a Windows runner.
Open the repo's **Actions** tab, pick **Build lumabar (Windows)**, click **Run workflow**, then download `lumabar-windows` from the finished run.
Pushing a tag like `lumabar-v0.1.0` also attaches the `.exe` files to a GitHub Release.
