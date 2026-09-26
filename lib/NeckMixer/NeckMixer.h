#pragma once

#include "ServoController.h"

// Mixes a single pitch/roll axis pair down to the two push-rod servos
// (`neck_left`/`neck_right` in SERVO_CHANNELS) that share the neck's ball
// joint: driving both rods the same amount nods the head (pitch), driving
// them opposite amounts tilts it (roll). `neck_yaw` rotates the whole
// assembly at the base and isn't mixed - drive it directly through
// ServoController.
class NeckMixer {
public:
  void begin(ServoController *servos);

  // pitchDeg/rollDeg are offsets from each rod's own (possibly
  // zero-calibrated) rest angle from ServoController, so existing per-servo
  // calibration for neck_left/neck_right still applies. speedDegPerSec <= 0
  // means instant, same convention as ServoController::setTarget().
  bool setPitch(float pitchDeg, float speedDegPerSec = 0);
  bool setRoll(float rollDeg, float speedDegPerSec = 0);

  float pitch() const { return pitchDeg; }
  float roll() const { return rollDeg; }

private:
  ServoController *servos = nullptr;
  float pitchDeg = 0;
  float rollDeg = 0;

  bool apply(float speedDegPerSec);
};
