#pragma once

#include "ServoController.h"

// Drives `eye_pan`/`eye_tilt` with small autonomous movements while Skelly
// is talking, so the eyes aren't dead-still during speech. Each time the
// eyes settle on a target, one of two animations is picked at random:
//   - Wander: a slower, wider glance, as if looking around at the audience.
//   - Dart: a quick, small saccade, as if flicking attention between points.
// Call update() every loop() with whether audio is currently playing. When
// talking stops, the eyes ease back to rest instead of being left wherever
// the last movement landed.
class EyeAnimator {
public:
  void begin(ServoController *servos);
  void update(bool talking);

private:
  ServoController *servos = nullptr;
  bool wasTalking = false;
  uint32_t nextMoveAtMs = 0;

  void pickNewTarget();
};
