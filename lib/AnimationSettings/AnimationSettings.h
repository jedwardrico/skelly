#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>

// Runtime-tunable jaw and eye animation parameters. Defaults come from
// Config.h; overrides are persisted to flash (NVS) so they survive reboots
// and are shared by every app that connects. Each setting is a plain float so
// the REST API and the app can treat them generically (see kAnimParams).
struct AnimationSettings {
  // Jaw (audio-driven)
  float jawGain;          // envelope multiplier before the sqrt curve
  float jawOpenFloor;     // min open fraction while speech is present
  float jawSilence;       // envelope below this = silence, jaw closes
  float jawAttackMs;      // envelope rise time constant
  float jawReleaseMs;     // envelope fall time constant
  float jawUpdateMs;      // min gap between servo writes

  // Eyes (idle animation while talking)
  float eyeDartChance;    // 0-1 probability a move is a dart vs a wander
  float eyeWanderPan;     // +/- degrees from rest
  float eyeWanderTilt;
  float eyeWanderSpeed;   // deg/sec
  float eyeDartPan;
  float eyeDartTilt;
  float eyeDartSpeed;
  float eyeIntervalMinMs; // pause between moves
  float eyeIntervalMaxMs;
  float eyeReturnSpeed;   // deg/sec easing back to rest after talking
};

struct AnimParamDef {
  const char *key;
  float AnimationSettings::*field;
  float minValue;
  float maxValue;
  float defaultValue;
};

extern const AnimParamDef kAnimParams[];
extern const size_t kAnimParamCount;

// Live values, read directly by the audio task, main loop and EyeAnimator.
extern AnimationSettings g_anim;

namespace AnimSettings {
// Fills g_anim from defaults, then applies any persisted overrides.
void begin();
// Writes {key: value} for every setting into `out`.
void toJson(JsonObject out);
// Applies any recognised keys in `in` (clamped to range) and persists them.
// Returns the number of keys applied.
int applyJson(JsonObjectConst in);
// Clears all persisted overrides and restores the defaults.
void reset();
} // namespace AnimSettings
