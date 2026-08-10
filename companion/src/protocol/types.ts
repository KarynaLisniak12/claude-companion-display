export type DisplayState =
  | "idle"
  | "working"
  | "tool"
  | "waiting"
  | "done"
  | "error"
  | "disconnected";

export interface StatusMessage {
  type: "status";
  state: DisplayState;
  activity?: string;
  task?: string;
  elapsedSeconds?: number;
  toolCalls?: number;
  completedTasks?: number;
  totalTasks?: number;
  seq: number;
}

export interface HeartbeatMessage {
  type: "heartbeat";
  seq: number;
}
export interface ProbeMessage {
  type: "probe";
}
export type OutboundMessage = StatusMessage | HeartbeatMessage | ProbeMessage;

export function encodeMessage(message: OutboundMessage): string {
  return `${JSON.stringify(message)}\n`;
}
