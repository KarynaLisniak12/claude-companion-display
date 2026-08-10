#include "Display.h"
#include "../../include/BoardConfig.h"

Display::Display() {
  bus_ = new Arduino_ESP32SPI(Board::LCD_DC, Board::LCD_CS, Board::LCD_SCLK,
                              Board::LCD_MOSI, GFX_NOT_DEFINED, FSPI);
  panel_ = new Arduino_ST7789(bus_, Board::LCD_RST, 0, true, Board::WIDTH, Board::HEIGHT,
                              Board::COL_OFFSET, 0, Board::COL_OFFSET, 0);
  gfx_ = new Arduino_Canvas(Board::WIDTH, Board::HEIGHT, panel_);
}

bool Display::begin() {
  pinMode(Board::LCD_BL, OUTPUT);
  digitalWrite(Board::LCD_BL, LOW);
  if (!panel_->begin(40000000)) return false;
  if (!gfx_->begin(GFX_SKIP_OUTPUT_BEGIN)) return false;
  gfx_->fillScreen(0x0000);
  gfx_->flush();
  if (!ledcAttach(Board::LCD_BL, 12000, 8)) return false;
  ledcWrite(Board::LCD_BL, (255 * Board::BACKLIGHT_PERCENT) / 100);
  return true;
}
