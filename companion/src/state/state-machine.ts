import type { ClaudeHookEvent } from "../claude-hooks/types.js";
import type { DisplayState, StatusMessage } from "../protocol/types.js";

interface SessionState {
  state: DisplayState;
  task: string;
  activity: string;
  startedAt: number;
  updatedAt: number;
  toolCalls: number;
  createdTasks: Set<string>;
  completedTasks: Set<string>;
  finishedElapsedSeconds?: number;
  toolUntil?: number;
}

const MAX_SESSIONS = 16;
const compact = (value: unknown, max = 52) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

function toolActivity(event: ClaudeHookEvent): string {
  const name = compact(event.tool_name, 24);
  const labels: Record<string, string> = {
    Read: "Reading files",
    Glob: "Finding files",
    Grep: "Searching code",
    Edit: "Editing code",
    Write: "Writing code",
    Bash: "Running command",
    Task: "Delegating task",
    WebFetch: "Reading the web",
    WebSearch: "Searching the web"
  };
  return labels[name] ?? (name ? `Using ${name}` : "Using a tool");
}

export class ClaudeStateMachine {
  private sessions = new Map<string, SessionState>();
  private activeId = "default";
  private sequence = 0;

  ingest(event: ClaudeHookEvent, now = Date.now()): StatusMessage {
    const id = compact(event.session_id, 80) || "default";
    let session = this.sessions.get(id);
    if (!session) {
      if (this.sessions.size >= MAX_SESSIONS) {
        const oldest = [...this.sessions.entries()].reduce((candidate, entry) =>
          entry[1].updatedAt < candidate[1].updatedAt ? entry : candidate
        );
        this.sessions.delete(oldest[0]);
      }
      session = {
        state: "idle",
        task: "",
        activity: "Ready",
        startedAt: now,
        updatedAt: now,
        toolCalls: 0,
        createdTasks: new Set(),
        completedTasks: new Set()
      };
      this.sessions.set(id, session);
    }
    this.activeId = id;
    session.updatedAt = now;
    const kind = event.hook_event_name ?? "";
    const isSubagent = Boolean(event.agent_id);
    if (kind !== "UserPromptSubmit" && (session.state === "done" || session.state === "error")) {
      return this.snapshot(now);
    }

    switch (kind) {
      case "UserPromptSubmit":
        session.state = "working";
        session.task = compact(event.prompt);
        session.activity = "Thinking";
        session.startedAt = now;
        session.toolCalls = 0;
        session.createdTasks.clear();
        session.completedTasks.clear();
        session.finishedElapsedSeconds = undefined;
        session.toolUntil = undefined;
        break;
      case "PreToolUse":
      case "PostToolUse":
        session.state = "tool";
        session.activity = toolActivity(event);
        session.toolUntil = now + (kind === "PreToolUse" ? 1400 : 900);
        if (kind === "PreToolUse") session.toolCalls++;
        break;
      case "PostToolUseFailure":
        session.state = "working";
        session.activity = `${toolActivity(event)} failed`;
        break;
      case "PermissionRequest":
        session.state = "waiting";
        session.activity = "Permission required";
        break;
      case "Notification":
        if (
          ["permission_prompt", "agent_needs_input", "elicitation_dialog"].includes(
            event.notification_type ?? ""
          )
        ) {
          session.state = "waiting";
          session.activity = compact(event.title || event.message) || "Needs your input";
        } else if (event.notification_type === "agent_completed") {
          session.state = "working";
          session.activity = compact(event.title || event.message) || "Agent finished; wrapping up";
        } else if (event.notification_type === "idle_prompt" && !isSubagent) {
          session.state = "done";
          session.activity = "Task finished";
          session.finishedElapsedSeconds = Math.max(
            0,
            Math.floor((now - session.startedAt) / 1000)
          );
        } else if (event.notification_type === "idle_prompt") {
          session.state = "working";
          session.activity = "Agent finished; main still working";
        }
        break;
      case "TaskCreated":
        if (event.task_id) session.createdTasks.add(event.task_id);
        session.state = "working";
        session.activity = compact(event.task_subject) || "Task created";
        break;
      case "TaskCompleted":
        if (event.task_id) {
          session.createdTasks.add(event.task_id);
          session.completedTasks.add(event.task_id);
        }
        session.state = "working";
        session.activity = compact(event.task_subject) || "Subtask complete";
        break;
      case "Stop":
        if (isSubagent) {
          session.state = "working";
          session.activity = "Agent finished; main still working";
        } else {
          session.state = "done";
          session.activity = "Task finished";
          session.finishedElapsedSeconds = Math.max(
            0,
            Math.floor((now - session.startedAt) / 1000)
          );
        }
        break;
      case "StopFailure":
        if (isSubagent) {
          session.state = "working";
          session.activity = "Agent failed; main is handling it";
        } else {
          session.state = "error";
          session.activity =
            compact(event.error_type || event.error || event.reason) ||
            "Claude stopped with an error";
          session.finishedElapsedSeconds = Math.max(
            0,
            Math.floor((now - session.startedAt) / 1000)
          );
        }
        break;
      case "SessionEnd":
        if (!isSubagent && session.state !== "done" && session.state !== "error")
          session.state = "idle";
        break;
    }
    return this.snapshot(now);
  }

  snapshot(now = Date.now()): StatusMessage {
    const session = this.sessions.get(this.activeId);
    if (!session) return { type: "status", state: "idle", activity: "Ready", seq: ++this.sequence };
    if (session.state === "tool" && session.toolUntil !== undefined && now >= session.toolUntil) {
      session.state = "working";
      session.toolUntil = undefined;
    }
    const total = session.createdTasks.size;
    return {
      type: "status",
      state: session.state,
      task: session.task || undefined,
      activity: session.activity || undefined,
      elapsedSeconds:
        session.finishedElapsedSeconds ?? Math.max(0, Math.floor((now - session.startedAt) / 1000)),
      toolCalls: session.toolCalls || undefined,
      completedTasks: total ? session.completedTasks.size : undefined,
      totalTasks: total || undefined,
      seq: ++this.sequence
    };
  }
}
