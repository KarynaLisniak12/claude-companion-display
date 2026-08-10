import http from "node:http";
import type { ClaudeHookEvent } from "./types.js";

const MAX_BODY_BYTES = 64 * 1024;

function isHookEvent(value: unknown): value is ClaudeHookEvent {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof (value as Record<string, unknown>).hook_event_name === "string"
  );
}

export function startHookServer(
  onEvent: (event: ClaudeHookEvent) => void,
  port = 17321
): http.Server {
  const server = http.createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/hook") {
      res.writeHead(404).end();
      return;
    }
    if (!req.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
      res.writeHead(415).end();
      return;
    }

    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) tooLarge = true;
      else chunks.push(chunk);
    });
    req.on("end", () => {
      if (tooLarge) {
        res.writeHead(413).end();
        return;
      }
      try {
        const event: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!isHookEvent(event)) {
          res.writeHead(400).end();
          return;
        }
        onEvent(event);
        res.writeHead(204).end();
      } catch {
        res.writeHead(400).end();
      }
    });
  });
  server.requestTimeout = 2_000;
  server.headersTimeout = 2_000;
  server.keepAliveTimeout = 1_000;
  server.maxRequestsPerSocket = 25;
  server.listen(port, "127.0.0.1", () => {
    const address = server.address();
    const actualPort = address && typeof address !== "string" ? address.port : port;
    console.log(`[hook] listening on http://127.0.0.1:${actualPort}/hook`);
  });
  return server;
}
