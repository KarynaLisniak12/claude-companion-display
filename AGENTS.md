# Project guidance

## Purpose

This monorepo drives a portable Waveshare ESP32-C6-LCD-1.47 (non-touch) from official Claude Code
lifecycle hooks. The primary feature is truthful task state, not account usage.

## Invariants

- Never put Claude credentials, cookies, tokens, or unofficial usage endpoints in firmware.
- Never invent percentage completion. Task totals require explicit task-system events.
- `DONE` belongs exclusively to the main conversation. Never map subagent events carrying `agent_id`
  or background `agent_completed` notifications to `DONE`.
- Display hooks are observational and must never block Claude Code. Keep the forwarder
  dependency-free, loopback-only, short-timeout, silent, and exit-success.
- Hardware is exactly the non-touch 172 × 320 board. Do not add touch behavior or guess pin mappings.
- Keep backlight at or below 50%; default is 45%.
- Keep serial lines bounded to 384 bytes and preserve malformed-input handling and stale-state
  behavior.
- Preserve user Claude settings when installing or uninstalling hooks.
- On Windows, setup owns only the exact per-user `ClaudeDeskDisplay.vbs` startup entry. Preserve every
  other startup item.

## Layout

- `companion/src/claude-hooks`: hook HTTP receiver and schema boundary
- `companion/src/state`: deterministic event reducer
- `companion/src/serial`: device probing and reconnect
- `companion/src/protocol`: wire types and encoder
- `firmware/src/display`: board display initialization
- `firmware/src/serial`: bounded JSON Lines parser
- `firmware/src/state`: embedded state model
- `firmware/src/ui`: primitive robot renderer and LED state

## Checks

Install dependencies with `npm install --prefix companion`. Run `npm run build` and `npm test` from
the repository root. Build firmware with `py -m platformio run -d firmware`; flash with the same
command plus `-t upload`.

Physical changes require verification on the exact board: screen offset and orientation, color order,
backlight polarity, and WS2812 color order.
