#pragma once

#include "ServoController.h"
#include "NeckMixer.h"

// Drives `neck_yaw` plus pitch/roll (via NeckMixer, down to neck_left/
// neck_right) with small autonomous movements while Skelly is talking. Same
// two move types as EyeAnimator, picked at random each time:
//   - Wander: a slow, wider turn of the head.
//   - Dart: a quick, small flick.
// Call update() every loop() with whether audio is currently playing. When
// talking stops, the neck eases back to rest.
class NeckAnimator {
public:
  void begin(ServoController *servos, NeckMixer *mixer);
  void update(bool talking);

private:
  ServoController *servos = nullptr;
  NeckMixer *mixer = nullptr;
  bool wasTalking = false;
  uint32_t nextMoveAtMs = 0;

  void pickNewTarget();
};
