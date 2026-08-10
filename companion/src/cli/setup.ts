import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const EVENTS = [
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "PermissionRequest",
  "Notification",
  "TaskCreated",
  "TaskCompleted",
  "Stop",
  "StopFailure",
  "SessionEnd"
];
const settingsPath = path.join(os.homedir(), ".claude", "settings.json");
const sourceHook = path.join(path.dirname(fileURLToPath(import.meta.url)), "hook-forwarder.cjs");
const marker = "claude-desk-display-hook";
const companionEntry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "index.js");
const backupPath = `${settingsPath}.claude-desk-display.bak`;

export function addDisplayHooks(
  settings: Record<string, unknown>,
  command: string
): Record<string, unknown> {
  const hooks = (
    settings.hooks && typeof settings.hooks === "object" && !Array.isArray(settings.hooks)
      ? settings.hooks
      : {}
  ) as Record<string, unknown[]>;
  for (const event of EVENTS) {
    const existing = Array.isArray(hooks[event]) ? hooks[event] : [];
    if (!JSON.stringify(existing).includes(marker)) {
      existing.push({ hooks: [{ type: "command", command, timeout: 2 }] });
    }
    hooks[event] = existing;
  }
  settings.hooks = hooks;
  return settings;
}

export function removeDisplayHooks(settings: Record<string, unknown>): Record<string, unknown> {
  const hooks = (
    settings.hooks && typeof settings.hooks === "object" && !Array.isArray(settings.hooks)
      ? settings.hooks
      : {}
  ) as Record<string, unknown[]>;
  for (const [event, groups] of Object.entries(hooks)) {
    hooks[event] = Array.isArray(groups)
      ? groups.filter((group) => !JSON.stringify(group).includes(marker))
      : groups;
    if (Array.isArray(hooks[event]) && hooks[event].length === 0) delete hooks[event];
  }
  settings.hooks = hooks;
  return settings;
}

function windowsStartupPath(): string {
  const appData = process.env.APPDATA;
  if (!appData) throw new Error("APPDATA is unavailable; cannot install Windows startup entry.");
  return path.join(
    appData,
    "Microsoft",
    "Windows",
    "Start Menu",
    "Programs",
    "Startup",
    "ClaudeDeskDisplay.vbs"
  );
}

function vbsString(value: string): string {
  return value.replace(/"/g, '""');
}

function installAutostart(): void {
  if (process.platform !== "win32") {
    console.log(
      "Automatic login startup is currently installed by setup on Windows only; use your OS service manager for this companion."
    );
    return;
  }
  const startupFile = windowsStartupPath();
  const workingDirectory = path.dirname(path.dirname(companionEntry));
  const script = [
    'Set shell = CreateObject("WScript.Shell")',
    `shell.CurrentDirectory = "${vbsString(workingDirectory)}"`,
    `shell.Run Chr(34) & "${vbsString(process.execPath)}" & Chr(34) & " " & Chr(34) & "${vbsString(companionEntry)}" & Chr(34), 0, False`,
    ""
  ].join("\r\n");
  fs.writeFileSync(startupFile, script);
  console.log(`Installed silent login startup entry at ${startupFile}.`);

  // Start it for the current login as well. If a manually-started companion is
  // already listening, this process exits harmlessly because the port is busy.
  const child = spawn(process.execPath, [companionEntry], {
    cwd: workingDirectory,
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
  console.log("Started the companion in the background for this login.");
}

function uninstallAutostart(): void {
  if (process.platform !== "win32") return;
  const startupFile = windowsStartupPath();
  fs.rmSync(startupFile, { force: true });
  console.log(`Removed login startup entry ${startupFile}.`);
}

function readSettings(): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, "utf8")) as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new Error(`Cannot parse ${settingsPath}; fix its JSON before installing.`);
  }
}

function writeSettings(settings: Record<string, unknown>): void {
  const directory = path.dirname(settingsPath);
  const temporaryPath = path.join(directory, `.settings.${process.pid}.tmp`);
  fs.mkdirSync(directory, { recursive: true });
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temporaryPath, settingsPath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

function install(): void {
  const hookDir = path.join(os.homedir(), ".claude", "hooks", "claude-desk-display");
  fs.mkdirSync(hookDir, { recursive: true });
  const installedHook = path.join(hookDir, "hook-forwarder.cjs");
  fs.copyFileSync(sourceHook, installedHook);
  const settings = readSettings();
  if (fs.existsSync(settingsPath) && !fs.existsSync(backupPath))
    fs.copyFileSync(settingsPath, backupPath);
  const command = `"${process.execPath.replace(/\\/g, "/")}" "${installedHook.replace(/\\/g, "/")}" # ${marker}`;
  writeSettings(addDisplayHooks(settings, command));
  console.log(`Installed display hooks in ${settingsPath}. Existing settings were preserved.`);
  installAutostart();
}

function uninstall(): void {
  const settings = readSettings();
  writeSettings(removeDisplayHooks(settings));
  console.log(`Removed display hooks from ${settingsPath}.`);
  uninstallAutostart();
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv[2] === "uninstall") uninstall();
  else if (process.argv[2] === "install") install();
  else throw new Error("Expected setup action: install or uninstall");
}
