# Firmware Flasher

A single-page ESP32 / ESP8266 firmware flasher that runs entirely in the browser
via the [Web Serial API](https://developer.chrome.com/docs/capabilities/serial) and
[esptool-js](https://github.com/espressif/esptool-js). No install, no build step —
just open the page, pick a `.bin` file, connect the board over USB, and flash.

Works in **Chrome or Edge on desktop**. Safari, Firefox, and mobile browsers don't
support Web Serial and will show a warning instead of the flasher.

## Using it

1. Open the page.
2. Select the `.bin` firmware file.
3. Click **Connect Device** and pick the board from the browser's port picker.
4. Click **Flash Firmware** and wait for it to finish — don't unplug the board or
   close the tab while it's running.

The flash address defaults to `0x0`, which is correct for a single merged firmware
image (the kind produced by `esptool.py merge_bin`). If you're flashing a raw
application-only binary instead, change the address under **Advanced options**.

## Personalizing it

Edit the `CONFIG` object at the top of [`app.js`](app.js) to change the title,
subtitle, and footer text. The rest of the page (steps, log, advanced options)
doesn't need to change.

## Deploying to GitHub Pages

1. Create a new **public** GitHub repo (Pages requires public on free plans, or
   any visibility on paid plans).
2. Push these files to the repo's default branch.
3. In the repo, go to **Settings → Pages**, set **Source** to "Deploy from a
   branch", pick the default branch and `/ (root)`, and save.
4. GitHub will publish the page at `https://<username>.github.io/<repo>/`.

## Notes

- Firmware never leaves the browser — the file is read locally and streamed
  directly to the serial port, nothing is uploaded anywhere.
- `esptool-js` is loaded from unpkg's CDN as an ES module (`app.js`), so there's
  nothing to `npm install` or build.
