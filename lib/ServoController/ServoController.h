#pragma once

#include <ESP32Servo.h>
#include <Preferences.h>
#include "Config.h"

// Drives every servo directly off its own ESP32 GPIO pin (see SERVO_CHANNELS
// in Config.h), wired through the Freenove breakout board's terminal blocks -
// no PCA9685 or other I2C PWM driver in the loop. Moves are non-blocking:
// call setTarget() to start a move and update() every loop() to advance it,
// so servo motion never stalls audio playback or the control API.
class ServoController {
public:
  void begin();

  // Advance any in-progress eased moves. Call every loop() iteration.
  void update();

  // Instant jump, no easing. Used by the jaw sync since it already gets a
  // smooth signal from the audio envelope follower.
  bool setAngle(const char *name, float angleDeg);
  bool setAngle(int index, float angleDeg);

  // Eased move toward angleDeg at speedDegPerSec. speedDegPerSec <= 0 means
  // instant (equivalent to setAngle).
  bool setTarget(const char *name, float angleDeg, float speedDegPerSec);

  // Send every servo to its effective rest angle (persisted override if one
  // was set via setRestAngle(), otherwise the compiled-in restAngle from
  // Config.h).
  void goToRest();

  // The effective rest/"zero" angle for a servo right now.
  float restAngle(const char *name) const;

  // Overrides a servo's rest angle and persists it to flash (NVS), so it
  // survives reboots without recompiling Config.h. Clamped to that servo's
  // configured min/max. Does not move the servo.
  bool setRestAngle(const char *name, float angleDeg);

  // Clears a persisted override, reverting restAngle() to the compiled-in
  // default. Does not move the servo.
  bool resetRestAngle(const char *name);

  int indexForName(const char *name) const;
  float currentAngle(int index) const;

private:
  Servo servoDrivers[SERVO_CHANNEL_COUNT];
  Preferences restPrefs;
  float current[SERVO_CHANNEL_COUNT] = {0};
  float target[SERVO_CHANNEL_COUNT] = {0};
  float speedDegPerSec[SERVO_CHANNEL_COUNT] = {0};
  float restOverride[SERVO_CHANNEL_COUNT] = {0};
  uint32_t lastUpdateMs = 0;

  uint16_t angleToPulseUs(int index, float angleDeg) const;
  float clampToRange(int index, float angleDeg) const;
  void writeIndex(int index, float angleDeg);
};
