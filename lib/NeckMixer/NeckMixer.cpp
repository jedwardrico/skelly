#include "NeckMixer.h"

void NeckMixer::begin(ServoController *servos_) {
  servos = servos_;
}

bool NeckMixer::apply(float speedDegPerSec) {
  float left = servos->restAngle("neck_left") + pitchDeg - rollDeg;
  float right = servos->restAngle("neck_right") + pitchDeg + rollDeg;
  bool ok = servos->setTarget("neck_left", left, speedDegPerSec);
  ok = servos->setTarget("neck_right", right, speedDegPerSec) && ok;
  return ok;
}

bool NeckMixer::setPitch(float pitchDeg_, float speedDegPerSec) {
  pitchDeg = pitchDeg_;
  return apply(speedDegPerSec);
}

bool NeckMixer::setRoll(float rollDeg_, float speedDegPerSec) {
  rollDeg = rollDeg_;
  return apply(speedDegPerSec);
}
