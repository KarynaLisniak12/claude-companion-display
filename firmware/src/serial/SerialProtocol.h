#pragma once
#include <Arduino.h>
#include "../state/AppState.h"

class SerialProtocol {
 public:
  explicit SerialProtocol(AppState& state) : state_(state) {}
  void begin();
  void poll();

 private:
  static constexpr size_t MAX_LINE = 384;
  AppState& state_;
  char line_[MAX_LINE + 1]{};
  size_t length_ = 0;
  bool overflow_ = false;
  void announce();
  void acknowledge(const char* message, uint32_t sequence = 0);
  void handleLine();
};
