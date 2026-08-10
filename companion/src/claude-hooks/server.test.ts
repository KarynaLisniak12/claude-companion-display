import type http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { startHookServer } from "./server.js";

let server: http.Server | undefined;

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
});

async function start(onEvent: Parameters<typeof startHookServer>[0]): Promise<string> {
  server = startHookServer(onEvent, 0);
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server has no TCP address");
  return `http://127.0.0.1:${address.port}/hook`;
}

describe("hook server", () => {
  it("accepts a valid JSON hook event", async () => {
    let received = "";
    const url = await start((event) => {
      received = event.hook_event_name ?? "";
    });
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hook_event_name: "Stop", session_id: "test" })
    });
    expect(response.status).toBe(204);
    expect(received).toBe("Stop");
  });

  it("rejects non-JSON and malformed events", async () => {
    const url = await start(() => undefined);
    const unsupported = await fetch(url, { method: "POST", body: "hook_event_name=Stop" });
    expect(unsupported.status).toBe(415);
    const malformed = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}"
    });
    expect(malformed.status).toBe(400);
  });

  it("rejects oversized bodies", async () => {
    const url = await start(() => undefined);
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hook_event_name: "Stop", padding: "x".repeat(65 * 1024) })
    });
    expect(response.status).toBe(413);
  });
});
