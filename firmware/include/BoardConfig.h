#pragma once
#include <Arduino.h>

namespace Board {
constexpr int LCD_MOSI = 6;
constexpr int LCD_SCLK = 7;
constexpr int LCD_CS = 14;
constexpr int LCD_DC = 15;
constexpr int LCD_RST = 21;
constexpr int LCD_BL = 22;
constexpr int RGB_LED = 8;
constexpr int WIDTH = 172;
constexpr int HEIGHT = 320;
constexpr int COL_OFFSET = 34;
constexpr uint8_t BACKLIGHT_PERCENT = 45;
constexpr uint32_t SERIAL_BAUD = 115200;
}  // namespace Board
