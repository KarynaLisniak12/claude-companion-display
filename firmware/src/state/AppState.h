#pragma once
#include <Arduino.h>

enum class DisplayState : uint8_t { Idle, Working, Tool, Waiting, Done, Error, Disconnected };

struct AppState {
  DisplayState state = DisplayState::Disconnected;
  String task;
  String activity = "Start companion";
  uint32_t elapsedSeconds = 0;
  uint16_t toolCalls = 0;
  int16_t completedTasks = -1;
  int16_t totalTasks = -1;
  uint32_t lastContactMs = 0;
  uint32_t stateChangedMs = 0;
  uint32_t toolBurstUntilMs = 0;
};

inline bool parseDisplayState(const char* value, DisplayState& result) {
  if (!value) return false;
  if (!strcmp(value, "idle")) result = DisplayState::Idle;
  else if (!strcmp(value, "working")) result = DisplayState::Working;
  else if (!strcmp(value, "tool")) result = DisplayState::Tool;
  else if (!strcmp(value, "waiting")) result = DisplayState::Waiting;
  else if (!strcmp(value, "done")) result = DisplayState::Done;
  else if (!strcmp(value, "error")) result = DisplayState::Error;
  else if (!strcmp(value, "disconnected")) result = DisplayState::Disconnected;
  else return false;
  return true;
}
