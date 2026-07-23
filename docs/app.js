import { ESPLoader, Transport } from "https://unpkg.com/esptool-js@0.6.0/bundle.js";

// ---- Personalize this page by editing the values below ----
const CONFIG = {
  title: "Firmware Flasher by Gramps",
  subtitle: "Flash your device straight from this page. No software to install.",
  footerNote: 'Built with <a href="https://github.com/espressif/esptool-js" target="_blank" rel="noopener">esptool-js</a>.',
};
// -------------------------------------------------------------

document.title = CONFIG.title;
document.getElementById("pageTitle").textContent = CONFIG.title;
document.getElementById("pageSubtitle").textContent = CONFIG.subtitle;
document.getElementById("footerNote").innerHTML = CONFIG.footerNote;

const els = {
  unsupported: document.getElementById("unsupported"),
  app: document.getElementById("app"),
  fileInput: document.getElementById("fileInput"),
  fileDrop: document.getElementById("fileDrop"),
  fileLabel: document.getElementById("fileLabel"),
  connectBtn: document.getElementById("connectBtn"),
  connectStatus: document.getElementById("connectStatus"),
  flashBtn: document.getElementById("flashBtn"),
  baudRate: document.getElementById("baudRate"),
  flashAddress: document.getElementById("flashAddress"),
  eraseAll: document.getElementById("eraseAll"),
  progressWrap: document.getElementById("progressWrap"),
  progressFill: document.getElementById("progressFill"),
  progressLabel: document.getElementById("progressLabel"),
  log: document.getElementById("log"),
  clearLogBtn: document.getElementById("clearLogBtn"),
  viewLogsBtn: document.getElementById("viewLogsBtn"),
  resetDeviceBtn: document.getElementById("resetDeviceBtn"),
  stopLogsBtn: document.getElementById("stopLogsBtn"),
};

let firmwareData = null;
let transport = null;
let esploader = null;
let device = null;
let logTransport = null;
let logStreamClosed = true;

function logLine(str) {
  els.log.textContent += str + "\n";
  els.log.scrollTop = els.log.scrollHeight;
}

const terminal = {
  clean() {
    els.log.textContent = "";
  },
  writeLine(data) {
    logLine(data);
  },
  write(data) {
    els.log.textContent += data;
    els.log.scrollTop = els.log.scrollHeight;
  },
};

function setConnectStatus(text, kind) {
  els.connectStatus.textContent = text;
  els.connectStatus.className = "status" + (kind ? " " + kind : "");
}

function updateFlashButtonState() {
  els.flashBtn.disabled = !(firmwareData && transport && esploader);
}

// --- Browser support check ---
if (!("serial" in navigator)) {
  els.unsupported.classList.remove("hidden");
  els.app.classList.add("hidden");
}

// --- File selection ---
function handleFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    firmwareData = new Uint8Array(reader.result);
    els.fileLabel.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    els.fileDrop.classList.add("has-file");
    updateFlashButtonState();
    logLine(`Loaded ${file.name}: ${firmwareData.length} bytes`);
  };
  reader.readAsArrayBuffer(file);
}

els.fileInput.addEventListener("change", (e) => {
  handleFile(e.target.files[0]);
});

els.fileDrop.addEventListener("dragover", (e) => {
  e.preventDefault();
  els.fileDrop.classList.add("dragover");
});

els.fileDrop.addEventListener("dragleave", () => {
  els.fileDrop.classList.remove("dragover");
});

els.fileDrop.addEventListener("drop", (e) => {
  e.preventDefault();
  els.fileDrop.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

// Enable connect once Web Serial is confirmed present.
els.connectBtn.disabled = false;

// --- Connect ---
els.connectBtn.addEventListener("click", async () => {
  try {
    els.connectBtn.disabled = true;
    setConnectStatus("Requesting device...");

    device = await navigator.serial.requestPort();
    transport = new Transport(device, true);

    const baudrate = parseInt(els.baudRate.value, 10);
    esploader = new ESPLoader({ transport, baudrate, terminal });

    setConnectStatus("Connecting...");
    const chipName = await esploader.main();

    setConnectStatus(`Connected: ${chipName}`, "good");
    logLine(`Connected to ${chipName}`);
    els.connectBtn.textContent = "Reconnect";
    updateFlashButtonState();
  } catch (err) {
    console.error(err);
    setConnectStatus(err.message || "Connection failed", "bad");
    logLine(`Error: ${err.message || err}`);
    transport = null;
    esploader = null;
    updateFlashButtonState();
  } finally {
    els.connectBtn.disabled = false;
  }
});

// --- Flash ---
els.flashBtn.addEventListener("click", async () => {
  if (!firmwareData || !esploader) return;

  let address;
  try {
    address = parseInt(els.flashAddress.value, 16);
    if (Number.isNaN(address)) throw new Error("bad address");
  } catch {
    logLine("Error: invalid flash address, expected something like 0x0");
    return;
  }

  els.flashBtn.disabled = true;
  els.connectBtn.disabled = true;
  els.progressWrap.classList.remove("hidden");
  els.progressFill.style.width = "0%";
  els.progressLabel.textContent = "0%";

  try {
    await esploader.writeFlash({
      fileArray: [{ data: firmwareData, address }],
      flashMode: "keep",
      flashFreq: "keep",
      flashSize: "keep",
      eraseAll: els.eraseAll.checked,
      compress: true,
      reportProgress: (fileIndex, written, total) => {
        const percent = Math.round((written / total) * 100);
        els.progressFill.style.width = percent + "%";
        els.progressLabel.textContent = percent + "%";
      },
    });

    logLine("Flash complete. Resetting device...");
    // Force the chip into reset, then release via its proper reset
    // procedure, then close the port. Leaving the port open after
    // release can leave DTR/RTS parked in a state that keeps some
    // boards from booting until they're power-cycled.
    await transport.setRTS(true);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await esploader.after();
    await transport.disconnect();

    logLine("Done! Your device is rebooting.");
    els.progressLabel.textContent = "Done!";

    transport = null;
    esploader = null;
    setConnectStatus("Disconnected", "");
    els.connectBtn.textContent = "Connect Device";

    // Give the board a moment to actually boot, then jump straight to
    // its console output so you don't have to reconnect manually.
    els.viewLogsBtn.classList.remove("hidden");
    setTimeout(startLogStream, 500);
  } catch (err) {
    console.error(err);
    logLine(`Error: ${err.message || err}`);
    els.progressLabel.textContent = "Failed";
  } finally {
    els.flashBtn.disabled = false;
    els.connectBtn.disabled = false;
    updateFlashButtonState();
  }
});

// --- Clear log ---
els.clearLogBtn.addEventListener("click", () => {
  els.log.textContent = "";
});

// --- Device logs ---
// Reopens the same already-authorized port (no picker dialog) to stream
// its console output, the way ESP Web Tools' "Logs" step does.
async function startLogStream() {
  if (!device) return;

  els.viewLogsBtn.classList.add("hidden");
  els.resetDeviceBtn.classList.remove("hidden");
  els.stopLogsBtn.classList.remove("hidden");
  els.connectBtn.disabled = true;

  try {
    logTransport = new Transport(device, true);
    await logTransport.connect(115200);
    logStreamClosed = false;
    logTransport.setDeviceLostCallback(() => stopLogStream());

    logLine("--- Viewing device logs (115200 baud) ---");
    const decoder = new TextDecoder();
    await logTransport.rawRead((data) => {
      els.log.textContent += decoder.decode(data);
      els.log.scrollTop = els.log.scrollHeight;
    }, () => logStreamClosed);
  } catch (err) {
    if (!logStreamClosed) logLine(`Log stream error: ${err.message || err}`);
  }
}

async function stopLogStream() {
  logStreamClosed = true;
  if (logTransport) {
    try {
      await logTransport.disconnect();
    } catch {
      // port may already be gone (e.g. device unplugged)
    }
    logTransport = null;
  }
  els.resetDeviceBtn.classList.add("hidden");
  els.stopLogsBtn.classList.add("hidden");
  els.viewLogsBtn.classList.remove("hidden");
  els.connectBtn.disabled = false;
}

// Same reset pulse used after flashing: assert EN low, hold briefly, release.
// Done while the log stream stays open, so the reboot's console output
// shows up live.
async function resetDevice() {
  if (!logTransport) return;
  logLine("--- Reset ---");
  await logTransport.setRTS(true);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await logTransport.setRTS(false);
}

els.viewLogsBtn.addEventListener("click", startLogStream);
els.resetDeviceBtn.addEventListener("click", resetDevice);
els.stopLogsBtn.addEventListener("click", stopLogStream);
