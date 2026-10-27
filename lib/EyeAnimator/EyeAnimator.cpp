#include "EyeAnimator.h"
#include "AnimationSettings.h"

namespace {
// Random offset in [-rangeDeg, +rangeDeg], with millidegree resolution.
float randomOffset(float rangeDeg) {
  return (float)random(-1000, 1001) / 1000.0f * rangeDeg;
}
} // namespace

void EyeAnimator::begin(ServoController *servos_) {
  servos = servos_;
}

void EyeAnimator::pickNewTarget() {
  bool dart = random(0, 1000) < (long)(g_anim.eyeDartChance * 1000.0f);
  float panRange = dart ? g_anim.eyeDartPan : g_anim.eyeWanderPan;
  float tiltRange = dart ? g_anim.eyeDartTilt : g_anim.eyeWanderTilt;
  float speed = dart ? g_anim.eyeDartSpeed : g_anim.eyeWanderSpeed;

  float pan = servos->restAngle("eye_pan") + randomOffset(panRange);
  float tilt = servos->restAngle("eye_tilt") + randomOffset(tiltRange);
  servos->setTarget("eye_pan", pan, speed);
  servos->setTarget("eye_tilt", tilt, speed);

  nextMoveAtMs = millis() + random((long)g_anim.eyeIntervalMinMs, (long)max(g_anim.eyeIntervalMinMs, g_anim.eyeIntervalMaxMs) + 1);
}

void EyeAnimator::update(bool talking) {
  if (!servos) return;

  if (!talking) {
    if (wasTalking) {
      servos->setTarget("eye_pan", servos->restAngle("eye_pan"), g_anim.eyeReturnSpeed);
      servos->setTarget("eye_tilt", servos->restAngle("eye_tilt"), g_anim.eyeReturnSpeed);
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
