#include "SerialProtocol.h"
#include <ArduinoJson.h>
#include "../../include/BoardConfig.h"

void SerialProtocol::begin() {
  Serial.begin(Board::SERIAL_BAUD);
  delay(50);
  announce();
}

void SerialProtocol::announce() {
  Serial.println(F("{\"type\":\"hello\",\"device\":\"claude-desk-display\",\"protocol\":1}"));
}

void SerialProtocol::acknowledge(const char* message, uint32_t sequence) {
  Serial.print(F("{\"type\":\"ack\",\"message\":\""));
  Serial.print(message);
  Serial.print(F("\",\"seq\":"));
  Serial.print(sequence);
  Serial.println('}');
}

void SerialProtocol::poll() {
  while (Serial.available()) {
    const char c = static_cast<char>(Serial.read());
    if (c == '\n') {
      if (!overflow_ && length_) {
        handleLine();
      }
      length_ = 0;
      overflow_ = false;
    } else if (c != '\r') {
      if (length_ < MAX_LINE) {
        line_[length_++] = c;
      } else {
        overflow_ = true;
      }
    }
  }
}

void SerialProtocol::handleLine() {
  line_[length_] = '\0';
  JsonDocument doc;
  const DeserializationError error = deserializeJson(doc, line_, length_);
  if (error) {
    return;
  }

  const char* type = doc["type"] | "";
  const uint32_t now = millis();
  if (!strcmp(type, "probe")) {
    announce();
    return;
  }
  if (!strcmp(type, "heartbeat")) {
    state_.lastContactMs = now;
    acknowledge("heartbeat", doc["seq"] | 0U);
    return;
  }
  if (strcmp(type, "status")) {
    return;
  }

  if (!doc["state"].is<const char*>()) {
    return;
  }
  DisplayState next;
  if (!parseDisplayState(doc["state"].as<const char*>(), next)) {
    return;
  }
  if (next != state_.state) {
    state_.state = next;
    state_.stateChangedMs = now;
  }
  if (next == DisplayState::Tool) {
    state_.toolBurstUntilMs = now + 1100;
  }
  if (doc["task"].is<const char*>()) {
    state_.task = String(doc["task"].as<const char*>()).substring(0, 52);
  }
  if (doc["activity"].is<const char*>()) {
    state_.activity = String(doc["activity"].as<const char*>()).substring(0, 52);
  }
  if (doc["elapsedSeconds"].is<uint32_t>()) {
    state_.elapsedSeconds = doc["elapsedSeconds"].as<uint32_t>();
  }
  if (doc["toolCalls"].is<uint16_t>()) {
    state_.toolCalls = doc["toolCalls"].as<uint16_t>();
  }

  state_.completedTasks = -1;
  state_.totalTasks = -1;
  if (doc["completedTasks"].is<int16_t>() && doc["totalTasks"].is<int16_t>()) {
    const int16_t completed = doc["completedTasks"].as<int16_t>();
    const int16_t total = doc["totalTasks"].as<int16_t>();
    if (completed >= 0 && total > 0 && completed <= total) {
      state_.completedTasks = completed;
      state_.totalTasks = total;
    }
  }
  state_.lastContactMs = now;
  acknowledge("status", doc["seq"] | 0U);
}
