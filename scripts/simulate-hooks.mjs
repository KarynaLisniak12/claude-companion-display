const events = [
  { hook_event_name: "UserPromptSubmit", session_id: "demo", prompt: "Build the desktop display" },
  { hook_event_name: "PreToolUse", session_id: "demo", tool_name: "Read" },
  { hook_event_name: "PostToolUse", session_id: "demo", tool_name: "Edit" },
  { hook_event_name: "PermissionRequest", session_id: "demo", tool_name: "Bash" },
  { hook_event_name: "PreToolUse", session_id: "demo", tool_name: "Bash" },
  { hook_event_name: "Stop", session_id: "demo" }
];
for (const event of events) {
  await fetch("http://127.0.0.1:17321/hook", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(event) });
  console.log(event.hook_event_name);
  await new Promise(resolve => setTimeout(resolve, 1800));
}
