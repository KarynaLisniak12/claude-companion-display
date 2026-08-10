import { describe, expect, it } from "vitest";
import { addDisplayHooks, removeDisplayHooks } from "./setup.js";

describe("Claude settings merge", () => {
  it("preserves existing settings and hooks", () => {
    const existing = {
      theme: "dark",
      hooks: { Stop: [{ hooks: [{ type: "command", command: "existing" }] }] }
    };
    const result = addDisplayHooks(
      structuredClone(existing),
      "node hook.cjs # claude-desk-display-hook"
    );
    expect(result.theme).toBe("dark");
    expect((result.hooks as Record<string, unknown[]>).Stop).toHaveLength(2);
  });

  it("is idempotent and removes only its own hook groups", () => {
    const command = "node hook.cjs # claude-desk-display-hook";
    const settings = { hooks: { Stop: [{ hooks: [{ type: "command", command: "existing" }] }] } };
    addDisplayHooks(settings, command);
    addDisplayHooks(settings, command);
    expect(settings.hooks.Stop as unknown[]).toHaveLength(2);

    removeDisplayHooks(settings);
    expect(settings.hooks.Stop).toEqual([{ hooks: [{ type: "command", command: "existing" }] }]);
  });
});
