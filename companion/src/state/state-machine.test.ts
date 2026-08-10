import { describe, expect, it } from "vitest";
import { ClaudeStateMachine } from "./state-machine.js";

describe("ClaudeStateMachine", () => {
  it("tracks the MVP lifecycle without fake progress", () => {
    const state = new ClaudeStateMachine();
    expect(
      state.ingest(
        { hook_event_name: "UserPromptSubmit", session_id: "s", prompt: "Build it" },
        1000
      ).state
    ).toBe("working");
    const tool = state.ingest(
      { hook_event_name: "PreToolUse", session_id: "s", tool_name: "Bash" },
      2000
    );
    expect(tool).toMatchObject({
      state: "tool",
      activity: "Running command",
      toolCalls: 1,
      elapsedSeconds: 1
    });
    expect(
      state.ingest({ hook_event_name: "PermissionRequest", session_id: "s" }, 3000).state
    ).toBe("waiting");
    expect(state.ingest({ hook_event_name: "Stop", session_id: "s" }, 4000).state).toBe("done");
  });

  it("reports only explicit task counts", () => {
    const state = new ClaudeStateMachine();
    expect(
      state.ingest({ hook_event_name: "UserPromptSubmit", session_id: "s" }).totalTasks
    ).toBeUndefined();
    state.ingest({ hook_event_name: "TaskCreated", session_id: "s", task_id: "1" });
    const result = state.ingest({
      hook_event_name: "TaskCompleted",
      session_id: "s",
      task_id: "1"
    });
    expect(result).toMatchObject({ completedTasks: 1, totalTasks: 1 });
  });

  it("does not finish when a subagent stops", () => {
    const state = new ClaudeStateMachine();
    state.ingest(
      { hook_event_name: "UserPromptSubmit", session_id: "multi", prompt: "Use multiple agents" },
      1000
    );
    const agentStop = state.ingest(
      { hook_event_name: "Stop", session_id: "multi", agent_id: "agent-1" },
      2000
    );
    expect(agentStop).toMatchObject({
      state: "working",
      activity: "Agent finished; main still working"
    });
    expect(state.ingest({ hook_event_name: "Stop", session_id: "multi" }, 3000).state).toBe("done");
  });

  it("does not treat background-agent notifications as main completion", () => {
    const state = new ClaudeStateMachine();
    state.ingest({ hook_event_name: "UserPromptSubmit", session_id: "multi" });
    expect(
      state.ingest({
        hook_event_name: "Notification",
        session_id: "multi",
        notification_type: "agent_completed"
      }).state
    ).toBe("working");
    expect(
      state.ingest({
        hook_event_name: "Notification",
        session_id: "multi",
        agent_id: "agent-2",
        notification_type: "idle_prompt"
      }).state
    ).toBe("working");
  });

  it("freezes elapsed time when the main task finishes", () => {
    const state = new ClaudeStateMachine();
    state.ingest({ hook_event_name: "UserPromptSubmit", session_id: "timed" }, 1000);
    expect(
      state.ingest({ hook_event_name: "Stop", session_id: "timed" }, 6200).elapsedSeconds
    ).toBe(5);
    expect(state.snapshot(60000).elapsedSeconds).toBe(5);
  });

  it("makes tool activity transient while preserving its description", () => {
    const state = new ClaudeStateMachine();
    state.ingest({ hook_event_name: "UserPromptSubmit", session_id: "tool" }, 1000);
    expect(
      state.ingest({ hook_event_name: "PreToolUse", session_id: "tool", tool_name: "Read" }, 2000)
        .state
    ).toBe("tool");
    expect(state.snapshot(3500)).toMatchObject({ state: "working", activity: "Reading files" });
  });

  it("keeps a terminal state when late agent events arrive", () => {
    const state = new ClaudeStateMachine();
    state.ingest({ hook_event_name: "UserPromptSubmit", session_id: "race" }, 1000);
    state.ingest({ hook_event_name: "Stop", session_id: "race" }, 2000);
    expect(
      state.ingest({ hook_event_name: "TaskCompleted", session_id: "race", task_id: "late" }, 2100)
        .state
    ).toBe("done");
    expect(
      state.ingest(
        {
          hook_event_name: "Notification",
          session_id: "race",
          notification_type: "agent_completed"
        },
        2200
      ).state
    ).toBe("done");
  });
});
