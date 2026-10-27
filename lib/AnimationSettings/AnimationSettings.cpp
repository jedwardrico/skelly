#include "AnimationSettings.h"
#include "Config.h"
#include <Preferences.h>

AnimationSettings g_anim;

static const char *kPrefsNamespace = "anim";

#define P(key, field, lo, hi, def) {key, &AnimationSettings::field, lo, hi, def}
const AnimParamDef kAnimParams[] = {
    P("jawGain", jawGain, 1.0f, 12.0f, JAW_LEVEL_GAIN),
    P("jawOpenFloor", jawOpenFloor, 0.0f, 1.0f, JAW_SPEECH_OPEN_FLOOR),
    P("jawSilence", jawSilence, 0.0f, 0.2f, JAW_SILENCE_LEVEL),
    P("jawAttackMs", jawAttackMs, 1.0f, 200.0f, JAW_ENVELOPE_ATTACK_MS),
    P("jawReleaseMs", jawReleaseMs, 5.0f, 600.0f, JAW_ENVELOPE_RELEASE_MS),
    P("jawUpdateMs", jawUpdateMs, 40.0f, 250.0f, JAW_UPDATE_MIN_INTERVAL_MS),
    P("eyeDartChance", eyeDartChance, 0.0f, 1.0f, EYE_DART_CHANCE),
    P("eyeWanderPan", eyeWanderPan, 0.0f, 90.0f, EYE_WANDER_PAN_DEG),
    P("eyeWanderTilt", eyeWanderTilt, 0.0f, 90.0f, EYE_WANDER_TILT_DEG),
    P("eyeWanderSpeed", eyeWanderSpeed, 5.0f, 400.0f, EYE_WANDER_SPEED_DPS),
    P("eyeDartPan", eyeDartPan, 0.0f, 90.0f, EYE_DART_PAN_DEG),
    P("eyeDartTilt", eyeDartTilt, 0.0f, 90.0f, EYE_DART_TILT_DEG),
    P("eyeDartSpeed", eyeDartSpeed, 5.0f, 600.0f, EYE_DART_SPEED_DPS),
    P("eyeIntervalMinMs", eyeIntervalMinMs, 100.0f, 10000.0f, EYE_INTERVAL_MIN_MS),
    P("eyeIntervalMaxMs", eyeIntervalMaxMs, 100.0f, 10000.0f, EYE_INTERVAL_MAX_MS),
    P("eyeReturnSpeed", eyeReturnSpeed, 5.0f, 400.0f, EYE_REST_RETURN_SPEED_DPS),
};
#undef P
const size_t kAnimParamCount = sizeof(kAnimParams) / sizeof(kAnimParams[0]);

static float clampParam(const AnimParamDef &p, float v) {
  return constrain(v, p.minValue, p.maxValue);
}

void AnimSettings::begin() {
  Preferences prefs;
  prefs.begin(kPrefsNamespace, /*readOnly=*/true);
  for (size_t i = 0; i < kAnimParamCount; i++) {
    const AnimParamDef &p = kAnimParams[i];
    g_anim.*(p.field) = clampParam(p, prefs.getFloat(p.key, p.defaultValue));
  }
  prefs.end();
}

void AnimSettings::toJson(JsonObject out) {
  for (size_t i = 0; i < kAnimParamCount; i++) {
    out[kAnimParams[i].key] = g_anim.*(kAnimParams[i].field);
  }
}

int AnimSettings::applyJson(JsonObjectConst in) {
  Preferences prefs;
  prefs.begin(kPrefsNamespace, /*readOnly=*/false);
  int applied = 0;
  for (size_t i = 0; i < kAnimParamCount; i++) {
    const AnimParamDef &p = kAnimParams[i];
    JsonVariantConst v = in[p.key];
    if (!v.is<float>()) continue;
    float value = clampParam(p, v.as<float>());
    g_anim.*(p.field) = value;
    prefs.putFloat(p.key, value);
    applied++;
  }
  prefs.end();
  return applied;
}

void AnimSettings::reset() {
  Preferences prefs;
  prefs.begin(kPrefsNamespace, /*readOnly=*/false);
  prefs.clear();
  prefs.end();
  for (size_t i = 0; i < kAnimParamCount; i++) {
    g_anim.*(kAnimParams[i].field) = kAnimParams[i].defaultValue;
  }
}
