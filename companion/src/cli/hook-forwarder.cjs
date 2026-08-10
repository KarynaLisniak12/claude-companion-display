// Dependency-free Claude Code command hook. It must never block Claude Code.
const http = require("node:http");
const MAX_BODY_BYTES = 64 * 1024;
let body = "";
let bytes = 0;
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  const remaining = MAX_BODY_BYTES - bytes;
  if (remaining <= 0) return;
  const accepted = Buffer.from(chunk).subarray(0, remaining);
  body += accepted.toString("utf8");
  bytes += accepted.length;
});
process.stdin.on("end", () => {
  let event;
  try {
    const input = JSON.parse(body);
    const allowed = [
      "session_id",
      "agent_id",
      "hook_event_name",
      "prompt",
      "tool_name",
      "notification_type",
      "message",
      "title",
      "task_id",
      "task_subject",
      "error",
      "error_type",
      "reason"
    ];
    event = Object.fromEntries(
      allowed
        .filter((key) => typeof input[key] === "string")
        .map((key) => [key, input[key].slice(0, 512)])
    );
    if (!event.hook_event_name) return process.exit(0);
  } catch {
    return process.exit(0);
  }

  const payload = JSON.stringify(event);
  const req = http.request(
    {
      hostname: "127.0.0.1",
      port: 17321,
      path: "/hook",
      method: "POST",
      headers: { "content-type": "application/json", "content-length": Buffer.byteLength(payload) },
      timeout: 350
    },
    () => process.exit(0)
  );
  req.on("timeout", () => {
    req.destroy();
    process.exit(0);
  });
  req.on("error", () => process.exit(0));
  req.end(payload);
});
setTimeout(() => process.exit(0), 500).unref();
