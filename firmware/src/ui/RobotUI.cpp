#include "RobotUI.h"
#include <math.h>
#include <Fonts/FreeSansBold12pt7b.h>
#include "../../include/BoardConfig.h"

namespace {
constexpr uint16_t BG = 0x0000;
constexpr uint16_t WHITE = 0xFFFF;
constexpr uint16_t MUTED = 0x7BEF;
constexpr uint16_t ORANGE = 0xD2E4;
constexpr uint16_t AMBER = 0xFD20;
constexpr uint16_t GREEN = 0x46E9;
constexpr uint16_t RED = 0xF986;
constexpr uint16_t CYAN = 0x3DFF;
constexpr uint16_t CARD = 0x1082;

const char* label(DisplayState state) {
  switch (state) {
    case DisplayState::Idle:
      return "Ready";
    case DisplayState::Working:
      return "Working";
    case DisplayState::Tool:
      return "Tool active";
    case DisplayState::Waiting:
      return "Needs you";
    case DisplayState::Done:
      return "Done";
    case DisplayState::Error:
      return "Error";
    default:
      return "Offline";
  }
}
uint16_t accent(DisplayState state) {
  switch (state) {
    case DisplayState::Done:
      return GREEN;
    case DisplayState::Waiting:
      return AMBER;
    case DisplayState::Error:
      return RED;
    case DisplayState::Disconnected:
      return MUTED;
    default:
      return ORANGE;
  }
}
}

RobotUI::RobotUI(Arduino_GFX& gfx, uint8_t ledPin) : g_(gfx), led_(1, ledPin, NEO_GRB + NEO_KHZ800) {}

void RobotUI::begin() {
  led_.begin();
  led_.clear();
  led_.show();
}

void RobotUI::centered(const String& text, int y, uint8_t size, uint16_t color) {
  g_.setFont(nullptr);
  g_.setTextSize(size);
  g_.setTextColor(color);
  g_.setTextWrap(false);
  int16_t x1, y1;
  uint16_t w, h;
  g_.getTextBounds(text, 0, y, &x1, &y1, &w, &h);
  g_.setCursor((Board::WIDTH - static_cast<int>(w)) / 2, y);
  g_.print(text);
}

void RobotUI::centeredFont(const String& text, int baselineY, const GFXfont* font, uint16_t color) {
  g_.setFont(font);
  g_.setTextSize(1);
  g_.setTextColor(color);
  g_.setTextWrap(false);
  int16_t x1, y1;
  uint16_t w, h;
  g_.getTextBounds(text, 0, baselineY, &x1, &y1, &w, &h);
  g_.setCursor((Board::WIDTH - static_cast<int>(w)) / 2 - x1, baselineY);
  g_.print(text);
}

void RobotUI::drawActivityText(const String& text) {
  constexpr int maxChars = 23;
  if (text.length() <= maxChars) {
    centered(text, 249, 1, WHITE);
    return;
  }

  int split = text.lastIndexOf(' ', maxChars);
  if (split <= 0) {
    split = maxChars;
  }
  String first = text.substring(0, split);
  String second = text.substring(text.charAt(split) == ' ' ? split + 1 : split);
  if (second.length() > maxChars) {
    second = second.substring(0, maxChars - 1) + "~";
  }
  centered(first, 244, 1, WHITE);
  centered(second, 256, 1, WHITE);
}

void RobotUI::drawHeader(const AppState& app, uint32_t now) {
  centered("CLAUDE", 12, 1, MUTED);
  const bool banner = app.state == DisplayState::Waiting || app.state == DisplayState::Done || app.state == DisplayState::Error;
  if (banner) {
    g_.fillRoundRect(8, 25, 156, 30, 8, accent(app.state));
    const char* text = label(app.state);
    if (app.state == DisplayState::Waiting && ((now / 1100) % 2)) text = "Check Claude";
    centered(text, 32, 2, BG);
  } else {
    centered(label(app.state), 30, 2, accent(app.state));
  }
}

void RobotUI::drawRobot(int cx, int cy, int bounce, bool blink, int leftArm, int rightArm) {
  const int x = cx - 43, y = cy - 47 + bounce;
  g_.fillRect(cx - 12, y - 14, 24, 13, WHITE); g_.fillRect(cx - 9, y - 11, 18, 8, ORANGE);
  g_.fillRect(x - 12, y + 18 + leftArm, 14, 35, WHITE); g_.fillRect(x - 9, y + 21 + leftArm, 9, 29, ORANGE);
  g_.fillRect(x + 84, y + 18 + rightArm, 14, 35, WHITE); g_.fillRect(x + 86, y + 21 + rightArm, 9, 29, ORANGE);
  g_.fillRect(x, y, 86, 78, WHITE); g_.fillRect(x + 4, y + 4, 78, 70, ORANGE);
  const int eyeH = blink ? 3 : 15;
  g_.fillRect(x + 18, y + 24 + (15 - eyeH) / 2, 15, eyeH, BG);
  g_.fillRect(x + 53, y + 24 + (15 - eyeH) / 2, 15, eyeH, BG);
  g_.fillRect(x + 13, y + 77, 23, 14, WHITE); g_.fillRect(x + 17, y + 77, 15, 10, ORANGE);
  g_.fillRect(x + 50, y + 77, 23, 14, WHITE); g_.fillRect(x + 54, y + 77, 15, 10, ORANGE);
}

void RobotUI::drawSymbol(const AppState& app, uint32_t now) {
  if (app.state == DisplayState::Working || app.state == DisplayState::Tool) {
    const int active = (now / 280) % 3;
    for (int i = 0; i < 3; ++i) g_.fillRect(62 + i * 22, 72, 8, 8, i == active ? WHITE : 0x4208);
  } else if (app.state == DisplayState::Waiting) {
    const bool pulse = ((now / 350) % 2) == 0;
    centered("!", 65, 3, pulse ? AMBER : WHITE);
  } else if (app.state == DisplayState::Done) {
    g_.drawLine(66, 75, 78, 87, GREEN); g_.drawLine(67, 75, 79, 87, GREEN);
    g_.drawLine(78, 87, 105, 60, GREEN); g_.drawLine(79, 87, 106, 60, GREEN);
  } else if (app.state == DisplayState::Error) {
    g_.drawLine(70, 65, 101, 90, RED); g_.drawLine(101, 65, 70, 90, RED);
  } else if (app.state == DisplayState::Disconnected) {
    centered("USB?", 72, 1, MUTED);
  }
}

void RobotUI::drawCelebration(uint32_t age) {
  if (age >= 3000) return;
  const uint16_t colors[] = {GREEN, AMBER, CYAN, WHITE, ORANGE, RED};
  const uint8_t xPositions[] = {16, 35, 57, 78, 101, 124, 145, 158};
  for (uint8_t i = 0; i < 8; ++i) {
    const int y = 62 + ((age / 13 + i * 29) % 154);
    const int sway = ((age / 180 + i) % 3) - 1;
    if (i % 2) g_.fillRect(xPositions[i] + sway, y, 4, 7, colors[i % 6]);
    else g_.fillRect(xPositions[i] + sway, y, 7, 4, colors[i % 6]);
  }
  const int starX[] = {24, 139, 43, 126};
  const int starY[] = {91, 108, 203, 187};
  for (uint8_t i = 0; i < 4; ++i) {
    if (((age / 220) + i) % 2) {
      g_.fillRect(starX[i] - 1, starY[i] - 5, 3, 11, WHITE);
      g_.fillRect(starX[i] - 5, starY[i] - 1, 11, 3, WHITE);
    }
  }
}

void RobotUI::drawFooter(const AppState& app) {
  g_.fillRoundRect(10, 232, 152, 80, 10, CARD);
  String activity = app.activity;
  activity.toUpperCase();
  drawActivityText(activity);
  char elapsed[12];
  const uint32_t mins = app.elapsedSeconds / 60;
  snprintf(elapsed, sizeof(elapsed), "%02lu:%02lu", (unsigned long)mins, (unsigned long)(app.elapsedSeconds % 60));
  centeredFont(elapsed, 289, &FreeSansBold12pt7b, WHITE);
  if (app.totalTasks > 0) {
    centered(String(app.completedTasks) + "/" + String(app.totalTasks) + " tasks", 303, 1, accent(app.state));
  } else if (app.toolCalls > 0) {
    centered(String(app.toolCalls) + " tool calls", 303, 1, MUTED);
  }
}

void RobotUI::updateLed(const AppState& app, uint32_t now) {
  float wave = (sinf(now / 500.0f) + 1.0f) * 0.5f;
  uint8_t level = static_cast<uint8_t>(4 + wave * 22);
  uint32_t color = 0;
  switch (app.state) {
    case DisplayState::Working: case DisplayState::Tool: color = led_.Color(level, level / 3, 0); break;
    case DisplayState::Waiting: color = led_.Color(level, level / 2, 0); break;
    case DisplayState::Done: color = led_.Color(0, level, level / 5); break;
    case DisplayState::Error: color = led_.Color(level, 0, 0); break;
    default: color = 0;
  }
  led_.setPixelColor(0, color); led_.show();
}

void RobotUI::render(const AppState& app, uint32_t now) {
  if (now - lastFrame_ < 100) return;
  lastFrame_ = now;
  g_.fillScreen(BG);
  if (app.state == DisplayState::Waiting) {
    const uint16_t pulse = ((now / 300) % 2) ? AMBER : WHITE;
    g_.drawRoundRect(0, 0, Board::WIDTH, Board::HEIGHT, 18, pulse);
    g_.drawRoundRect(2, 2, Board::WIDTH - 4, Board::HEIGHT - 4, 16, pulse);
    g_.drawRoundRect(4, 4, Board::WIDTH - 8, Board::HEIGHT - 8, 14, AMBER);
  } else if (app.state == DisplayState::Done) {
    g_.drawRoundRect(0, 0, Board::WIDTH, Board::HEIGHT, 18, GREEN);
    g_.drawRoundRect(2, 2, Board::WIDTH - 4, Board::HEIGHT - 4, 16, GREEN);
    g_.drawRoundRect(4, 4, Board::WIDTH - 8, Board::HEIGHT - 8, 14, GREEN);
  } else if (app.state == DisplayState::Error) {
    g_.drawRoundRect(0, 0, Board::WIDTH, Board::HEIGHT, 18, RED);
    g_.drawRoundRect(2, 2, Board::WIDTH - 4, Board::HEIGHT - 4, 16, RED);
  }
  drawHeader(app, now);
  drawSymbol(app, now);
  const uint32_t age = now - app.stateChangedMs;
  int bounce = 0, leftArm = 0, rightArm = 0, robotX = 86;
  if (app.state == DisplayState::Done && age < 3000) {
    const int beat = (age / 220) % 4;
    robotX += (beat == 0 || beat == 3) ? -5 : 5;
    leftArm = (beat % 2) ? -20 : -8;
    rightArm = (beat % 2) ? -8 : -20;
    const int jumpPhase = age % 750;
    bounce = -static_cast<int>((jumpPhase < 240 ? jumpPhase : (jumpPhase < 480 ? 480 - jumpPhase : 0)) / 10);
    drawCelebration(age);
  } else if (app.state == DisplayState::Working || app.state == DisplayState::Tool) {
    const float speed = now < app.toolBurstUntilMs ? 65.0f : 150.0f;
    bounce = static_cast<int>(sinf(now / speed) * 2.0f);
    leftArm = now < app.toolBurstUntilMs ? static_cast<int>(sinf(now / 55.0f) * 7.0f) : 0;
    rightArm = -leftArm;
  } else if (app.state == DisplayState::Waiting) {
    bounce = ((now / 260) % 2) ? -3 : 1;
    leftArm = -9; rightArm = -9;
  } else if (app.state == DisplayState::Error && age < 900) {
    bounce = ((now / 75) % 2) ? -4 : 4;
  } else if (app.state == DisplayState::Idle) {
    bounce = static_cast<int>(sinf(now / 700.0f));
  }
  const bool blink = (now % 4300) > 4180;
  drawRobot(robotX, 161, bounce, blink, leftArm, rightArm);
  drawFooter(app);
  g_.flush();
  updateLed(app, now);
}
