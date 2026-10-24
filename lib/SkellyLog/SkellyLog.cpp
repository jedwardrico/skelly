#include "SkellyLog.h"

SkellyLogBuffer SkellyLog;

SkellyLogBuffer::SkellyLogBuffer() { lock = xSemaphoreCreateMutex(); }

size_t SkellyLogBuffer::write(uint8_t c) { return write(&c, 1); }

size_t SkellyLogBuffer::write(const uint8_t *buf, size_t size) {
  Serial.write(buf, size);
  xSemaphoreTake(lock, portMAX_DELAY);
  for (size_t i = 0; i < size; i++) feed(buf[i]);
  xSemaphoreGive(lock);
  return size;
}

void SkellyLogBuffer::feed(uint8_t c) {
  if (c == '\r') return;
  if (c == '\n') {
    commitLine();
    return;
  }
  pending += (char)c;
  if (pending.length() >= kMaxLineLen) commitLine();
}

void SkellyLogBuffer::commitLine() {
  seq++;
  Line &slot = ring[seq % kRingLines];
  slot.seq = seq;
  slot.text = pending;
  pending = "";
}

uint32_t SkellyLogBuffer::latestSeq() {
  xSemaphoreTake(lock, portMAX_DELAY);
  uint32_t s = seq;
  xSemaphoreGive(lock);
  return s;
}

size_t SkellyLogBuffer::collectSince(uint32_t afterSeq, std::vector<Line> &out, size_t maxLines) {
  xSemaphoreTake(lock, portMAX_DELAY);
  uint32_t oldest = seq > kRingLines ? seq - kRingLines + 1 : 1;
  uint32_t first = afterSeq + 1 > oldest ? afterSeq + 1 : oldest;
  size_t added = 0;
  for (uint32_t s = first; s <= seq && added < maxLines; s++, added++) {
    out.push_back(ring[s % kRingLines]);
  }
  xSemaphoreGive(lock);
  return added;
}
