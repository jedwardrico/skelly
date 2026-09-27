#include "EyeAnimator.h"

namespace {
// Wander: slower, wider glances.
const float kWanderPanRangeDeg = 30.0f;
const float kWanderTiltRangeDeg = 18.0f;
const float kWanderSpeedDegPerSec = 45.0f;

// Dart: quick, small saccades.
const float kDartPanRangeDeg = 12.0f;
const float kDartTiltRangeDeg = 8.0f;
const float kDartSpeedDegPerSec = 220.0f;

const uint32_t kMoveIntervalMinMs = 350;
const uint32_t kMoveIntervalMaxMs = 1800;
const float kRestReturnSpeedDegPerSec = 60.0f;

// Random offset in [-rangeDeg, +rangeDeg], with millidegree resolution.
float randomOffset(float rangeDeg) {
  return (float)random(-1000, 1001) / 1000.0f * rangeDeg;
}
} // namespace

void EyeAnimator::begin(ServoController *servos_) {
  servos = servos_;
}

void EyeAnimator::pickNewTarget() {
  bool dart = random(0, 2) == 0;
  float panRange = dart ? kDartPanRangeDeg : kWanderPanRangeDeg;
  float tiltRange = dart ? kDartTiltRangeDeg : kWanderTiltRangeDeg;
  float speed = dart ? kDartSpeedDegPerSec : kWanderSpeedDegPerSec;

  float pan = servos->restAngle("eye_pan") + randomOffset(panRange);
  float tilt = servos->restAngle("eye_tilt") + randomOffset(tiltRange);
  servos->setTarget("eye_pan", pan, speed);
  servos->setTarget("eye_tilt", tilt, speed);

  nextMoveAtMs = millis() + random((long)kMoveIntervalMinMs, (long)kMoveIntervalMaxMs);
}

void EyeAnimator::update(bool talking) {
  if (!servos) return;

  if (!talking) {
    if (wasTalking) {
      servos->setTarget("eye_pan", servos->restAngle("eye_pan"), kRestReturnSpeedDegPerSec);
      servos->setTarget("eye_tilt", servos->restAngle("eye_tilt"), kRestReturnSpeedDegPerSec);
      wasTalking = false;
    }
    return;
  }

  if (!wasTalking) {
    wasTalking = true;
    nextMoveAtMs = millis();
  }

  if ((int32_t)(millis() - nextMoveAtMs) >= 0) {
    pickNewTarget();
  }
}
