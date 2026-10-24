#pragma once

#include <Arduino.h>
#include <vector>

// Drop-in replacement for Serial in the firmware's own logging: everything
// written here still goes out the USB serial port, and complete lines are
// also kept in a small RAM ring buffer so ControlAPI can show them in the
// app (GET /api/logs for the backlog, "log" frames over /ws for new lines).
// Use SkellyLog.println()/printf() exactly like Serial.
class SkellyLogBuffer : public Print {
public:
  struct Line {
    uint32_t seq; // 1-based, increases by one per line, never reused
    String text;
  };

  SkellyLogBuffer();

  size_t write(uint8_t c) override;
  size_t write(const uint8_t *buf, size_t size) override;

  // Sequence number of the most recent complete line (0 if none yet).
  uint32_t latestSeq();

  // Appends retained lines with seq > afterSeq to out, oldest first, at most
  // maxLines of them. Returns the number appended.
  size_t collectSince(uint32_t afterSeq, std::vector<Line> &out, size_t maxLines);

private:
  static constexpr size_t kRingLines = 100;
  static constexpr size_t kMaxLineLen = 200;

  Line ring[kRingLines];
  uint32_t seq = 0;
  String pending;
  SemaphoreHandle_t lock;

  void feed(uint8_t c); // caller holds lock
  void commitLine();    // caller holds lock
};

extern SkellyLogBuffer SkellyLog;
