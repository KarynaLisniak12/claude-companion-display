# Claude Companion Display

A portable physical status display for Claude Code, built for the
[Waveshare ESP32-C6-LCD-1.47](https://docs.waveshare.com/ESP32-C6-LCD-1.47)
(non-touch model).

The display shows real Claude Code lifecycle states instead of inventing a completion percentage:

- `READY` — waiting for a prompt
- `WORKING` — Claude is responding
- `TOOL ACTIVE` — Claude is using a tool
- `NEEDS YOU` — input or permission is required
- `DONE` — the main Claude Code response finished
- `ERROR` — the main response failed
- `OFFLINE` — the desktop companion is unavailable

The firmware contains no Claude credentials and is not tied to an account or computer. Install the
desktop companion on each computer, then move the same display between them.

## How it works

```text
Claude Code lifecycle event
        ↓
Claude Code command hook
        ↓
local companion at 127.0.0.1:17321
        ↓
USB serial, JSON Lines at 115200 baud
        ↓
ESP32-C6 display and RGB LED
```

Claude Code hooks report prompts, tool activity, permission requests, task events, completion, and
failures. A dependency-free forwarding script sends a small, sanitized event to the companion. The
companion converts events into display state and automatically finds the ESP32 over USB.

The hook always exits successfully. Claude Code continues normally when the companion is stopped or
the display is unplugged.

See [Architecture](docs/architecture.md) and [Serial protocol](docs/protocol.md) for implementation
details.

## Hardware

This firmware supports exactly:

- Waveshare ESP32-C6-LCD-1.47
- 172 × 320 ST7789 display
- non-touch model

Use a USB-C cable that supports data. The display backlight is set to 45%.

## Requirements

- Node.js 20 or newer
- Claude Code
- Python 3.10 or newer
- PlatformIO Core
- Git

Install PlatformIO if needed:

```powershell
# Windows
py -m pip install --user platformio
```

```bash
# macOS or Linux
python3 -m pip install --user platformio
```

## Installation

All paths below assume the terminal is open in the repository root.

### 1. Install companion dependencies

```powershell
npm install --prefix companion
```

### 2. Build the firmware

```powershell
# Windows
py -m platformio run -d firmware
```

```bash
# macOS or Linux
python3 -m platformio run -d firmware
```

### 3. Find the device port

Connect the board and list serial devices:

```powershell
py -m platformio device list
```

On Windows the port looks like `COM3`. On macOS or Linux it usually looks like
`/dev/cu.usbmodem...` or `/dev/ttyACM0`.

Close the companion, PlatformIO serial monitor, Arduino IDE, and any other program using that port
before flashing.

### 4. Flash the firmware

Let PlatformIO choose the port:

```powershell
py -m platformio run -d firmware -t upload
```

If automatic detection fails, specify the port shown in the previous step:

```powershell
# Windows example
py -m platformio run -d firmware -t upload --upload-port COM3
```

```bash
# macOS/Linux example
python3 -m platformio run -d firmware -t upload --upload-port /dev/ttyACM0
```

If the board does not enter download mode, hold **BOOT**, press and release **RESET**, then release
**BOOT** and run the upload command again. The upload port and the normal runtime port can have
different names, especially on Windows.

After a successful flash, reset the board. It should show `OFFLINE` until the companion connects.

### 5. Install Claude Code hooks and the companion

```powershell
npm run setup
```

Setup performs the following actions:

1. builds the TypeScript companion;
2. copies the forwarding hook to `~/.claude/hooks/claude-desk-display`;
3. merges display hooks into `~/.claude/settings.json` without replacing existing hooks;
4. creates a one-time settings backup;
5. on Windows, installs a hidden per-user startup entry and starts the companion immediately.

Restart Claude Code after setup so it reloads its hook configuration.

#### Windows

Setup starts the companion as a hidden background process immediately and creates a per-user startup
entry for future logins. **Do not run `npm run companion` after setup.** A second instance cannot bind
to port `17321` and exits with `EADDRINUSE` (`address already in use`).

Wait up to five seconds after connecting the display. If it still shows `OFFLINE`, follow
[Diagnose an offline display on Windows](#diagnose-an-offline-display-on-windows) to replace the
hidden instance with a visible one and inspect its serial connection.

#### macOS and Linux

Automatic startup installation is currently Windows-only. On macOS and Linux, run the companion
manually or configure it with the operating system's user service manager:

```bash
npm run companion
```

### 6. Verify the complete flow

Start a new Claude Code session and submit a prompt. Expected transitions are:

```text
READY → WORKING → TOOL ACTIVE → WORKING → NEEDS YOU (when required) → DONE
```

`DONE` is emitted only when the main Claude Code response finishes. Completion of a subagent or an
individual Claude task keeps the display in `WORKING`.

## Test without Claude Code

The simulator needs a running companion. On Windows, the background companion installed by setup is
already running, so do not start another one. Open a terminal in the repository root and run:

```powershell
node scripts/simulate-hooks.mjs
```

The display should cycle through working, tool activity, waiting, and done states.

On macOS or Linux, start the companion in the first terminal:

```bash
npm run companion
```

Expected companion output:

```text
[hook] listening on http://127.0.0.1:17321/hook
[serial] connected to ...
```

Then run the simulator from a second terminal:

```bash
node scripts/simulate-hooks.mjs
```

## Daily use

On Windows, no terminal is required after setup:

1. sign in to Windows;
2. connect the display;
3. start Claude Code;
4. submit a prompt.

The companion scans every 2.5 seconds and reconnects after unplugging and reconnecting the display.
Run `npm run setup` once on every computer where the display will be used. The firmware does not need
to be changed between computers or Claude accounts.

## Configuration

The companion normally discovers the display automatically. To force a specific port, set
`CLAUDE_DISPLAY_PORT` before starting it:

```powershell
$env:CLAUDE_DISPLAY_PORT = "COM3"
npm run companion
```

```bash
CLAUDE_DISPLAY_PORT=/dev/ttyACM0 npm run companion
```

This is intended for diagnosis; a fixed port is less portable.

## Uninstall

```powershell
npm run uninstall
```

This removes only hook groups marked as belonging to Claude Companion Display and removes the Windows
startup entry. Existing Claude Code settings and unrelated hooks are preserved.

Uninstall does not terminate a companion process that is already running. Sign out, restart the
computer, or stop that Node.js process. The copied hook directory can then be removed manually:

```text
~/.claude/hooks/claude-desk-display
```

## Development

```powershell
# TypeScript build
npm run build

# Unit tests
npm test

# Companion development mode
npm --prefix companion run dev

# Firmware build
py -m platformio run -d firmware
```

The verified firmware build uses approximately 17 KB RAM and 377 KB flash. Generated files are
stored under `firmware/.pio/` and `companion/dist/` and are not committed.

## Troubleshooting

### PlatformIO says that `firmware` does not exist

You are probably inside the `companion` directory. Return to the repository root:

```powershell
cd ..
py -m platformio run -d firmware
```

Alternatively, from `companion`, use `-d ..\firmware`.

### Upload port is missing or busy

Run `py -m platformio device list` again. Do not assume that a previous `COM` number is still valid.
Close the companion and all serial monitors before uploading. Restart the board and retry with the
currently listed port.

### The display stays OFFLINE

`OFFLINE` means the firmware is not receiving serial status or heartbeat messages. It does not
necessarily mean that the local HTTP server is stopped. A process can own port `17321` while failing
to connect to the ESP32 serial port.

#### Diagnose an offline display on Windows

From the repository root, find the process listening on port `17321`:

```powershell
$connection = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 17321 -State Listen -ErrorAction SilentlyContinue
if ($connection) { Get-Process -Id $connection.OwningProcess }
```

If it shows `node`, stop only that companion instance and start it visibly:

```powershell
if ($connection) { Stop-Process -Id $connection.OwningProcess }
npm run companion
```

Do not close this terminal while diagnosing. A healthy connection prints both lines:

```text
[hook] listening on http://127.0.0.1:17321/hook
[serial] connected to COM3
```

If `[serial] connected` does not appear, open a second PowerShell window and list the current ports:

```powershell
py -m platformio device list
```

Do not reuse the COM number from another computer. Close PlatformIO Serial Monitor, Arduino IDE, and
other serial programs. Then stop the visible companion with `Ctrl+C` and retry with the detected port:

```powershell
$env:CLAUDE_DISPLAY_PORT = "COM3" # replace COM3 with the detected port
npm run companion
```

The environment variable applies only to that PowerShell window. Once diagnosis is complete, stop
the visible process with `Ctrl+C` and run `npm run setup` again to restore normal background operation.

If the serial port is not listed at all:

- confirm that the firmware was flashed successfully;
- use a data-capable USB cable;
- try another USB port;
- press the board's **RESET** button;
- inspect **Device Manager → Ports (COM & LPT)** on Windows.

### The companion reports that port 17321 is already in use

The Windows background companion installed by `npm run setup` is already running. This is expected;
do not start a second copy for normal use. If you need visible logs, use the exact PowerShell steps in
[Diagnose an offline display on Windows](#diagnose-an-offline-display-on-windows).

### The device works, but Claude events do not appear

- restart Claude Code after running setup;
- use Claude Code's `/hooks` command to confirm the installed events;
- rerun `npm run setup` safely if needed;
- run `node scripts/simulate-hooks.mjs` to separate hook problems from serial problems.

### The display flashes continuously

Make sure the current firmware is installed. It renders through one RGB565 canvas to avoid visible
full-screen clear/redraw flicker. Also verify that the USB cable and power supply are stable.

## Security and privacy

- No Claude cookies, tokens, API keys, or account credentials are stored in firmware.
- The HTTP receiver binds only to `127.0.0.1`.
- The forwarding hook sends only a small allowlist of lifecycle fields.
- Hook request bodies and serial lines have strict size limits.
- Malformed hook or serial messages are ignored safely.
- Hook delivery failure never blocks Claude Code.

## Project layout

```text
companion/   Node.js + TypeScript hook receiver, state machine, and serial connection
firmware/    PlatformIO + Arduino firmware for the ESP32-C6 display
docs/        Architecture and serial protocol documentation
scripts/     Local lifecycle simulator
```

## Sources of truth

- [Waveshare ESP32-C6-LCD-1.47 documentation](https://docs.waveshare.com/ESP32-C6-LCD-1.47)
- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks)
- [Claude Code hooks guide](https://code.claude.com/docs/en/hooks-guide)
