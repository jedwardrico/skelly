#pragma once

#include <Adafruit_PWMServoDriver.h>
#include "Config.h"

// Drives every servo on the PCA9685 by name (see SERVO_CHANNELS in Config.h).
// Moves are non-blocking: call setTarget() to start a move and update() every
// loop() to advance it, so servo motion never stalls audio playback or the
// control API.
class ServoController {
public:
  void begin();

  // Advance any in-progress eased moves. Call every loop() iteration.
  void update();

  // Instant jump, no easing. Used by the jaw sync since it already gets a
  // smooth signal from the audio envelope follower.
  bool setAngle(const char *name, float angleDeg);
  bool setAngle(uint8_t channel, float angleDeg);

  // Eased move toward angleDeg at speedDegPerSec. speedDegPerSec <= 0 means
  // instant (equivalent to setAngle).
  bool setTarget(const char *name, float angleDeg, float speedDegPerSec);

  // Send every servo to its configured restAngle.
  void goToRest();

  int channelForName(const char *name) const;
  float currentAngle(uint8_t channel) const;

private:
  Adafruit_PWMServoDriver pwm{PCA9685_I2C_ADDRESS};
  float current[SERVO_CHANNEL_COUNT] = {0};
  float target[SERVO_CHANNEL_COUNT] = {0};
  float speedDegPerSec[SERVO_CHANNEL_COUNT] = {0};
  uint32_t lastUpdateMs = 0;

  uint16_t angleToPulse(uint8_t channel, float angleDeg) const;
  float clampToRange(uint8_t channel, float angleDeg) const;
  void writeChannel(uint8_t channel, float angleDeg);
};
