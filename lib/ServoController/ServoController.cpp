#include "ServoController.h"

void ServoController::begin() {
  pwm.begin();
  pwm.setPWMFreq(SERVO_PWM_FREQ_HZ);
  delay(10); // PCA9685 needs the oscillator to settle before the first write

  for (size_t i = 0; i < SERVO_CHANNEL_COUNT; i++) {
    current[i] = SERVO_CHANNELS[i].restAngle;
    target[i] = SERVO_CHANNELS[i].restAngle;
    speedDegPerSec[i] = 0;
    writeChannel(SERVO_CHANNELS[i].channel, current[i]);
  }
  lastUpdateMs = millis();
}

int ServoController::channelForName(const char *name) const {
  for (size_t i = 0; i < SERVO_CHANNEL_COUNT; i++) {
    if (strcmp(SERVO_CHANNELS[i].name, name) == 0) {
      return SERVO_CHANNELS[i].channel;
    }
  }
  return -1;
}

float ServoController::clampToRange(uint8_t channel, float angleDeg) const {
  for (size_t i = 0; i < SERVO_CHANNEL_COUNT; i++) {
    if (SERVO_CHANNELS[i].channel == channel) {
      return constrain(angleDeg, SERVO_CHANNELS[i].minAngle, SERVO_CHANNELS[i].maxAngle);
    }
  }
  return angleDeg;
}

uint16_t ServoController::angleToPulse(uint8_t channel, float angleDeg) const {
  float clamped = clampToRange(channel, angleDeg);
  return (uint16_t)map((long)(clamped * 100), 0, 18000, SERVO_PULSE_MIN, SERVO_PULSE_MAX);
}

void ServoController::writeChannel(uint8_t channel, float angleDeg) {
  pwm.setPWM(channel, 0, angleToPulse(channel, angleDeg));
}

bool ServoController::setAngle(const char *name, float angleDeg) {
  int channel = channelForName(name);
  if (channel < 0) return false;
  return setAngle((uint8_t)channel, angleDeg);
}

bool ServoController::setAngle(uint8_t channel, float angleDeg) {
  if (channel >= 16) return false;
  float clamped = clampToRange(channel, angleDeg);
  writeChannel(channel, clamped);
  if (channel < SERVO_CHANNEL_COUNT) {
    current[channel] = clamped;
    target[channel] = clamped;
  }
  return true;
}

bool ServoController::setTarget(const char *name, float angleDeg, float speed) {
  int channel = channelForName(name);
  if (channel < 0 || (size_t)channel >= SERVO_CHANNEL_COUNT) return false;
  if (speed <= 0) {
    return setAngle((uint8_t)channel, angleDeg);
  }
  target[channel] = clampToRange((uint8_t)channel, angleDeg);
  speedDegPerSec[channel] = speed;
  return true;
}

void ServoController::update() {
  uint32_t now = millis();
  float dt = (now - lastUpdateMs) / 1000.0f;
  lastUpdateMs = now;
  if (dt <= 0) return;

  for (size_t i = 0; i < SERVO_CHANNEL_COUNT; i++) {
    if (speedDegPerSec[i] <= 0) continue;
    float diff = target[i] - current[i];
    if (fabs(diff) < 0.5f) {
      current[i] = target[i];
      speedDegPerSec[i] = 0;
      continue;
    }
    float step = speedDegPerSec[i] * dt;
    current[i] += (diff > 0) ? min(step, diff) : max(-step, diff);
    writeChannel(SERVO_CHANNELS[i].channel, current[i]);
  }
}

void ServoController::goToRest() {
  for (size_t i = 0; i < SERVO_CHANNEL_COUNT; i++) {
    setTarget(SERVO_CHANNELS[i].name, SERVO_CHANNELS[i].restAngle, 90.0f);
  }
}

float ServoController::currentAngle(uint8_t channel) const {
  if (channel >= SERVO_CHANNEL_COUNT) return 0;
  return current[channel];
}
