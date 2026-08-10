#pragma once
#include <Adafruit_NeoPixel.h>
#include <Arduino_GFX_Library.h>
#include "../state/AppState.h"

class RobotUI {
 public:
  RobotUI(Arduino_GFX& gfx, uint8_t ledPin);
  void begin();
  void render(const AppState& app, uint32_t now);

 private:
  Arduino_GFX& g_;
  Adafruit_NeoPixel led_;
  uint32_t lastFrame_ = 0;
  void drawRobot(int cx, int cy, int bounce, bool blink, int leftArm, int rightArm);
  void drawHeader(const AppState& app, uint32_t now);
  void drawFooter(const AppState& app);
  void drawSymbol(const AppState& app, uint32_t now);
  void drawCelebration(uint32_t age);
  void updateLed(const AppState& app, uint32_t now);
  void centered(const String& text, int y, uint8_t size, uint16_t color);
  void centeredFont(const String& text, int baselineY, const GFXfont* font, uint16_t color);
  void drawActivityText(const String& text);
};
