import { SerialPort } from "serialport";
import { encodeMessage, type OutboundMessage } from "../protocol/types.js";

const SCAN_MS = 2500;
const ESPRESSIF_USB_VID = "303a";

export interface SerialDeviceInfo {
  path: string;
  vendorId?: string;
  pnpId?: string;
  manufacturer?: string;
}

export function isDisplayCandidate(port: SerialDeviceInfo): boolean {
  const vendorId = port.vendorId?.toLowerCase();
  const pnpId = port.pnpId?.toLowerCase() ?? "";
  const manufacturer = port.manufacturer?.toLowerCase() ?? "";
  return (
    vendorId === ESPRESSIF_USB_VID ||
    pnpId.includes(`vid_${ESPRESSIF_USB_VID}`) ||
    manufacturer.includes("espressif")
  );
}

export class DeviceManager {
  private port?: SerialPort;
  private timer?: NodeJS.Timeout;
  private scanning = false;
  private running = false;
  private statusAcknowledged = false;
  private lastMessage?: OutboundMessage;

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.scan();
    this.timer = setInterval(() => void this.scan(), SCAN_MS);
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.port?.close();
    this.port = undefined;
    this.statusAcknowledged = false;
  }

  send(message: OutboundMessage): void {
    this.lastMessage = message.type === "status" ? message : this.lastMessage;
    if (this.port?.isOpen) {
      this.port.write(encodeMessage(message), (error) => {
        if (error) console.warn(`[serial] write failed: ${error.message}`);
      });
    }
  }

  private async scan(): Promise<void> {
    if (!this.running || this.port?.isOpen || this.scanning) return;
    this.scanning = true;
    try {
      const ports = await SerialPort.list();
      const configuredPath = process.env.CLAUDE_DISPLAY_PORT?.trim();
      const candidates = configuredPath
        ? ports.filter((port) => port.path.toLowerCase() === configuredPath.toLowerCase())
        : ports.filter(isDisplayCandidate);
      for (const info of candidates) {
        if (!this.running) break;
        if (await this.tryPort(info.path)) break;
      }
    } catch (error) {
      console.warn("[serial] scan failed:", error instanceof Error ? error.message : error);
    } finally {
      this.scanning = false;
    }
  }

  private tryPort(path: string): Promise<boolean> {
    return new Promise((resolve) => {
      const candidate = new SerialPort({ path, baudRate: 115200, autoOpen: false });
      let settled = false;
      let buffer = "";
      let timeout: NodeJS.Timeout;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (ok && this.running) {
          resolve(true);
          return;
        }
        if (this.port === candidate) this.port = undefined;
        if (candidate.isOpen) candidate.close(() => resolve(false));
        else resolve(false);
      };
      timeout = setTimeout(() => finish(false), 850);
      candidate.on("error", (error) => {
        if (this.port === candidate) console.warn(`[serial] ${error.message}`);
        finish(false);
      });
      candidate.on("data", (chunk: Buffer) => {
        buffer = (buffer + chunk.toString("utf8")).slice(-512);
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          try {
            const message = JSON.parse(line) as Record<string, unknown>;
            if (message.type === "ack" && message.message === "status") {
              if (!this.statusAcknowledged) {
                this.statusAcknowledged = true;
                console.log(`[serial] display acknowledged status on ${path}`);
              }
              continue;
            }
            if (
              message.type !== "hello" ||
              message.device !== "claude-desk-display" ||
              message.protocol !== 1
            )
              continue;
            if (!this.running) {
              finish(false);
              return;
            }
            this.port = candidate;
            this.statusAcknowledged = false;
            console.log(`[serial] connected to ${path}`);
            candidate.on("close", () => {
              if (this.port === candidate) {
                this.port = undefined;
                this.statusAcknowledged = false;
              }
            });
            if (this.lastMessage) candidate.write(encodeMessage(this.lastMessage));
            finish(true);
            break;
          } catch {
            // Ignore boot logs and unrelated serial output while probing.
          }
        }
      });
      candidate.open((error) => {
        if (error) return finish(false);
        candidate.write(encodeMessage({ type: "probe" }));
      });
    });
  }
}
