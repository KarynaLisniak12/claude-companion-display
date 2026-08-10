import { startHookServer } from "./claude-hooks/server.js";
import { DeviceManager } from "./serial/device-manager.js";
import { ClaudeStateMachine } from "./state/state-machine.js";

const devices = new DeviceManager();
const state = new ClaudeStateMachine();
devices.start();

const server = startHookServer((event) => {
  const message = state.ingest(event);
  console.log(
    `[state] ${event.hook_event_name ?? "unknown"} -> ${message.state} (${message.activity ?? ""})`
  );
  devices.send(message);
});

const statusTimer = setInterval(() => devices.send(state.snapshot()), 1000);
const heartbeatTimer = setInterval(
  () => devices.send({ type: "heartbeat", seq: Date.now() & 0x7fffffff }),
  5000
);

let shuttingDown = false;

function shutdown(exitCode = 0): void {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(statusTimer);
  clearInterval(heartbeatTimer);
  devices.stop();
  process.exitCode = exitCode;
  if (server.listening) server.close();
}

server.on("error", (error) => {
  console.error(`[hook] server error: ${error.message}`);
  shutdown(1);
});
process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());
