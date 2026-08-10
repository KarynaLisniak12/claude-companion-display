# Architecture

## Components

```text
Claude Code
  │ official command hooks
  ▼
hook-forwarder.cjs
  │ sanitized HTTP POST
  ▼
127.0.0.1:17321/hook
  │ lifecycle event
  ▼
ClaudeStateMachine
  │ compact status message
  ▼
DeviceManager
  │ USB CDC, JSON Lines, 115200 baud
  ▼
ESP32-C6 firmware
  ├─ bounded serial parser
  ├─ application state
  └─ display and RGB LED renderer
```

### Hook forwarder

Claude Code starts `hook-forwarder.cjs` for configured lifecycle events. The script has no package
dependencies, accepts at most 64 KB on stdin, and forwards only allowlisted string fields. It uses a
350 ms request timeout and exits successfully whether delivery succeeds or fails.

### Companion

The TypeScript companion listens only on `127.0.0.1`. It validates incoming JSON, derives display
state, and sends a refreshed status every second. A separate heartbeat is sent every five seconds.

Serial discovery runs every 2.5 seconds. By default it probes only serial ports identified as
Espressif devices. A device is accepted only after returning this exact handshake:

```json
{ "type": "hello", "device": "claude-desk-display", "protocol": 1 }
```

The companion reconnects automatically after USB disconnects.

### Firmware

The firmware reads newline-delimited JSON into a fixed 384-byte buffer. Oversized, malformed, and
unknown messages are discarded. If no valid status or heartbeat arrives for 15 seconds, the state
changes to `OFFLINE`.

The UI uses Arduino_GFX primitives rather than image or video assets. One 172 × 320 RGB565 canvas is
allocated at startup to prevent redraw flicker. The robot renders at approximately 10 FPS.

## State transitions

| Claude Code event                  | Display state | Notes                                                  |
| ---------------------------------- | ------------- | ------------------------------------------------------ |
| `UserPromptSubmit`                 | `WORKING`     | Resets elapsed time and counters                       |
| `PreToolUse`                       | `TOOL ACTIVE` | Increments tool-call count                             |
| `PostToolUse`                      | `TOOL ACTIVE` | Short activity burst, then returns to working          |
| `PostToolUseFailure`               | `WORKING`     | Reports failed activity; the main response may recover |
| `PermissionRequest`                | `NEEDS YOU`   | Requests user attention                                |
| input or permission `Notification` | `NEEDS YOU`   | Includes supported permission/input notifications      |
| `TaskCreated`                      | `WORKING`     | Adds a deterministic task to the total                 |
| `TaskCompleted`                    | `WORKING`     | Increments deterministic completed-task count          |
| main-thread `Stop`                 | `DONE`        | Freezes elapsed time                                   |
| subagent `Stop`                    | `WORKING`     | Never marks the main response done                     |
| main-thread `StopFailure`          | `ERROR`       | Freezes elapsed time                                   |
| missing heartbeat                  | `OFFLINE`     | Triggered by firmware after 15 seconds                 |

An event with `agent_id` belongs to a subagent. Subagent completion, `agent_completed`, and individual
task completion never produce `DONE`. Only completion of the main Claude Code response does.

## Multiple Claude sessions

The companion retains up to 16 session states. The most recent session to emit an event controls the
display. This supports several Claude Code terminals without binding the hardware to a particular
session or account.

## Trust boundaries

- Claude credentials never enter the pipeline.
- The local receiver is not exposed to the network.
- Large or malformed inputs are rejected at both desktop and firmware boundaries.
- Claude Code does not depend on successful hook delivery.
- The installer modifies only marked hook groups and its own Windows startup file.
