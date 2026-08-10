#pragma once
#include <Arduino_GFX_Library.h>

class Display {
 public:
  Display();
  bool begin();
  Arduino_GFX& gfx() { return *gfx_; }

 private:
  Arduino_DataBus* bus_;
  Arduino_GFX* panel_;
  Arduino_GFX* gfx_;
};
