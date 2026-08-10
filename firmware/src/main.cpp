#include <Arduino.h>
#include "../include/BoardConfig.h"
#include "display/Display.h"
#include "serial/SerialProtocol.h"
#include "state/AppState.h"
#include "ui/RobotUI.h"

namespace {
Display display;
AppState app;
SerialProtocol protocol(app);
RobotUI ui(display.gfx(), Board::RGB_LED);
constexpr uint32_t STALE_AFTER_MS = 15000;
}

void setup() {
  protocol.begin();
  if (!display.begin()) {
    Serial.println(F("Display initialization failed"));
    while (true) delay(1000);
  }
  ui.begin();
  app.stateChangedMs = millis();
}

void loop() {
  protocol.poll();
  const uint32_t now = millis();
  if (app.lastContactMs && now - app.lastContactMs > STALE_AFTER_MS && app.state != DisplayState::Disconnected) {
    app.state = DisplayState::Disconnected;
    app.activity = "Companion disconnected";
    app.stateChangedMs = now;
  }
  ui.render(app, now);
  delay(2);
}
