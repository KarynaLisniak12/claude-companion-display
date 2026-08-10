export interface ClaudeHookEvent {
  session_id?: string;
  /** Present when the hook fires inside a subagent rather than the main thread. */
  agent_id?: string;
  hook_event_name?: string;
  prompt?: string;
  tool_name?: string;
  notification_type?: string;
  message?: string;
  title?: string;
  task_id?: string;
  task_subject?: string;
  error?: string;
  error_type?: string;
  reason?: string;
}
