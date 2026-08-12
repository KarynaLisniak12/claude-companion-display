# Serial protocol

## Transport

- USB CDC serial
- 115200 baud
- UTF-8 JSON Lines: one JSON object followed by `\n`
- maximum inbound firmware line: 384 bytes
- protocol version: `1`

Unknown message types, invalid fields, malformed JSON, and oversized lines are ignored.

## Discovery

The companion sends:

```json
{ "type": "probe" }
```

Compatible firmware responds:

```json
{ "type": "hello", "device": "claude-desk-display", "protocol": 1 }
```

The companion accepts the port only when all three response fields match.

## Status message

```json
{
  "type": "status",
  "state": "tool",
  "task": "Build the status display",
  "activity": "Running command",
  "elapsedSeconds": 83,
  "toolCalls": 4,
  "completedTasks": 2,
  "totalTasks": 5,
  "seq": 19
}
```

| Field            | Type                 | Required | Description                           |
| ---------------- | -------------------- | -------- | ------------------------------------- |
| `type`           | `"status"`           | yes      | Message discriminator                 |
| `state`          | string               | yes      | Current display state                 |
| `task`           | string               | no       | Current prompt or task title          |
| `activity`       | string               | no       | Latest real lifecycle activity        |
| `elapsedSeconds` | non-negative integer | no       | Time since the current prompt started |
| `toolCalls`      | non-negative integer | no       | Observed `PreToolUse` count           |
| `completedTasks` | non-negative integer | no       | Explicit completed Claude task count  |
| `totalTasks`     | positive integer     | no       | Explicit created Claude task count    |
| `seq`            | integer              | yes      | Companion message sequence            |

Valid `state` values:

```text
idle
working
tool
waiting
done
error
disconnected
```

Task counts are present only when Claude Code emits explicit task-system events. The protocol has no
percentage field because arbitrary Claude tasks do not expose truthful percentage completion.

The firmware truncates `task` and `activity` to 52 characters. Task counts are accepted only when
`0 <= completedTasks <= totalTasks`.

## Heartbeat

The companion sends a heartbeat every five seconds:

```json
{ "type": "heartbeat", "seq": 12345 }
```

It also sends a complete status refresh every second. When the firmware receives neither a valid
heartbeat nor a valid status for 15 seconds, it displays `OFFLINE`.

## Acknowledgement

After applying a status or heartbeat, firmware returns an acknowledgement containing the received
sequence number:

```json
{ "type": "ack", "message": "status", "seq": 19 }
```

The companion logs the first status acknowledgement after each serial connection. This distinguishes
a successful serial handshake from a status message actually accepted by firmware.
