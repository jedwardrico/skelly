#include "NeckAnimator.h"
#include "AnimationSettings.h"

namespace {
// Random offset in [-rangeDeg, +rangeDeg], with millidegree resolution.
float randomOffset(float rangeDeg) {
  return (float)random(-1000, 1001) / 1000.0f * rangeDeg;
}
} // namespace

void NeckAnimator::begin(ServoController *servos_, NeckMixer *mixer_) {
  servos = servos_;
  mixer = mixer_;
}

void NeckAnimator::pickNewTarget() {
  bool dart = random(0, 1000) < (long)(g_anim.neckDartChance * 1000.0f);
  float yawRange = dart ? g_anim.neckDartYaw : g_anim.neckWanderYaw;
  float pitchRange = dart ? g_anim.neckDartPitch : g_anim.neckWanderPitch;
  float rollRange = dart ? g_anim.neckDartRoll : g_anim.neckWanderRoll;
  float speed = dart ? g_anim.neckDartSpeed : g_anim.neckWanderSpeed;

  servos->setTarget("neck_yaw", servos->restAngle("neck_yaw") + randomOffset(yawRange), speed);
  mixer->setPitch(randomOffset(pitchRange), speed);
  mixer->setRoll(randomOffset(rollRange), speed);

  nextMoveAtMs = millis() + random((long)g_anim.neckIntervalMinMs,
                                   (long)max(g_anim.neckIntervalMinMs, g_anim.neckIntervalMaxMs) + 1);
}

void NeckAnimator::update(bool talking) {
  if (!servos || !mixer) return;

  if (!talking) {
    if (wasTalking) {
      servos->setTarget("neck_yaw", servos->restAngle("neck_yaw"), g_anim.neckReturnSpeed);
      mixer->setPitch(0, g_anim.neckReturnSpeed);
      mixer->setRoll(0, g_anim.neckReturnSpeed);
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
