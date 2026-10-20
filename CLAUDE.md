# CLAUDE.md

A single-page, in-browser firmware flasher for ESP32/ESP8266 boards ("Firmware Flasher by Gramps"). It uses the Web Serial API and `esptool-js`, so it works only in desktop Chrome or Edge. The firmware file is read locally and never uploaded. Public repo, published as a GitHub Pages site (live link is in `docs/README.md`).

## Layout
- `docs/index.html`, `docs/style.css`, `docs/app.js` - the whole site. No build step, no package.json, no tests.
- `docs/app.js` - an ES module that imports `esptool-js` 0.6.0 from the unpkg CDN. A `CONFIG` object at the top holds the page title, subtitle, footer and the OTA partition addresses. Functions: `connectDevice`, `handleFile`, `applyFlashMode`, `startLogStream`/`stopLogStream`, `resetDevice`.
- `docs/README.md` - user guide and Pages deployment notes. `docs/logo.png`, `docs/favicon.ico` are site assets.
- `.claude/launch.json` - preview config: `python -m http.server 4321 -d docs`.

## Run locally
- `python -m http.server 4321 -d docs`, then open http://localhost:4321 in Chrome or Edge. Flashing needs a real board over USB; I did not find any automated tests.

## Gotchas
- Two flash modes: **Full** writes at `0x0` (merged image, resets WiFi) and **App update (OTA)** writes the app at `0x20000` and resets the boot-slot selector at `0xf000` (size `0x2000`). Those addresses assume the partition layout of the projects this page serves (`CONFIG.otaAppAddress`, `otadataAddress`, `otadataSize`); they are not generic, so check them against a project's partition table before relying on OTA mode.
- The `esptool-js` version is pinned in the import URL at the top of `app.js`; upgrading it can change the API.
- Safari, Firefox and phones lack Web Serial; the page shows a warning instead of the flasher.
- The root `.gitignore` excludes `/favicon.ico` and `/grey fox circle.png`, which are source assets kept outside the site.

## Deploy
- Static GitHub Pages site. The source files live in `docs/`, while `docs/README.md` describes serving from the root. I could not tell from the repo which Pages source is configured, so confirm in the repo's Pages settings before moving files.
- Pushing to `main` is the whole release process; there are no tags or release workflows.
