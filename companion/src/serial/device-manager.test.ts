import { describe, expect, it } from "vitest";
import { isDisplayCandidate } from "./device-manager.js";

describe("isDisplayCandidate", () => {
  it("accepts Espressif native USB devices", () => {
    expect(isDisplayCandidate({ path: "COM3", vendorId: "303A" })).toBe(true);
    expect(isDisplayCandidate({ path: "/dev/ttyACM0", manufacturer: "Espressif Systems" })).toBe(
      true
    );
  });

  it("does not probe unrelated serial devices", () => {
    expect(isDisplayCandidate({ path: "COM1" })).toBe(false);
    expect(isDisplayCandidate({ path: "COM4", vendorId: "2341", manufacturer: "Arduino" })).toBe(
      false
    );
  });
});
