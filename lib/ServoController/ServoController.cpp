#include "ServoController.h"

// NVS namespace for persisted rest-angle overrides. Keys are servo names
// (SERVO_CHANNELS[i].name, all well under the 15-char NVS key limit).
static const char *REST_PREFS_NAMESPACE = "skelly-servo";

void ServoController::begin() {
  restPrefs.begin(REST_PREFS_NAMESPACE, /*readOnly=*/false);
  for (size_t i = 0; i < SERVO_CHANNEL_COUNT; i++) {
    servoDrivers[i].setPeriodHertz(SERVO_PWM_FREQ_HZ);
    servoDrivers[i].attach(SERVO_CHANNELS[i].pin, SERVO_PULSE_MIN_US, SERVO_PULSE_MAX_US);

    float restDefault = SERVO_CHANNELS[i].restAngle;
    restOverride[i] = restPrefs.isKey(SERVO_CHANNELS[i].name)
                           ? restPrefs.getFloat(SERVO_CHANNELS[i].name, restDefault)
                           : restDefault;
    current[i] = restOverride[i];
    target[i] = restOverride[i];
    speedDegPerSec[i] = 0;
    writeIndex(i, current[i]);
  }
  lastUpdateMs = millis();
}

int ServoController::indexForName(const char *name) const {
  for (size_t i = 0; i < SERVO_CHANNEL_COUNT; i++) {
    if (strcmp(SERVO_CHANNELS[i].name, name) == 0) return (int)i;
  }
  return -1;
}

float ServoController::clampToRange(int index, float angleDeg) const {
  if (index < 0 || (size_t)index >= SERVO_CHANNEL_COUNT) return angleDeg;
  return constrain(angleDeg, SERVO_CHANNELS[index].minAngle, SERVO_CHANNELS[index].maxAngle);
}

uint16_t ServoController::angleToPulseUs(int index, float angleDeg) const {
  float clamped = clampToRange(index, angleDeg);
  return (uint16_t)map((long)(clamped * 100), 0, 18000, SERVO_PULSE_MIN_US, SERVO_PULSE_MAX_US);
}

void ServoController::writeIndex(int index, float angleDeg) {
  servoDrivers[index].writeMicroseconds(angleToPulseUs(index, angleDeg));
}

bool ServoController::setAngle(const char *name, float angleDeg) {
  int index = indexForName(name);
  if (index < 0) return false;
  return setAngle(index, angleDeg);
}

bool ServoController::setAngle(int index, float angleDeg) {
  if (index < 0 || (size_t)index >= SERVO_CHANNEL_COUNT) return false;
  float clamped = clampToRange(index, angleDeg);
  writeIndex(index, clamped);
  current[index] = clamped;
  target[index] = clamped;
  return true;
}

bool ServoController::setTarget(const char *name, float angleDeg, float speed) {
  int index = indexForName(name);
  if (index < 0) return false;
  if (speed <= 0) {
    return setAngle(index, angleDeg);
  }
  target[index] = clampToRange(index, angleDeg);
  speedDegPerSec[index] = speed;
  return true;
}

void ServoController::update() {
  uint32_t now = millis();
  float dt = (now - lastUpdateMs) / 1000.0f;
  lastUpdateMs = now;
  if (dt <= 0) return;

  for (size_t i = 0; i < SERVO_CHANNEL_COUNT; i++) {
    if (speedDegPerSec[i] <= 0) continue;
    float diff = target[i] - current[i];
    if (fabs(diff) < 0.5f) {
      current[i] = target[i];
      speedDegPerSec[i] = 0;
      continue;
    }
    float step = speedDegPerSec[i] * dt;
    current[i] += (diff > 0) ? min(step, diff) : max(-step, diff);
    writeIndex(i, current[i]);
  }
}

void ServoController::goToRest() {
  for (size_t i = 0; i < SERVO_CHANNEL_COUNT; i++) {
    setTarget(SERVO_CHANNELS[i].name, restOverride[i], 90.0f);
  }
}

float ServoController::restAngle(const char *name) const {
  int i = indexForName(name);
  return i < 0 ? 0 : restOverride[i];
}

bool ServoController::setRestAngle(const char *name, float angleDeg) {
  int i = indexForName(name);
  if (i < 0) return false;
  float clamped = clampToRange(i, angleDeg);
  restOverride[i] = clamped;
  restPrefs.putFloat(name, clamped);
  return true;
}

bool ServoController::resetRestAngle(const char *name) {
  int i = indexForName(name);
  if (i < 0) return false;
  restOverride[i] = SERVO_CHANNELS[i].restAngle;
  restPrefs.remove(name);
  return true;
}

float ServoController::currentAngle(int index) const {
  if (index < 0 || (size_t)index >= SERVO_CHANNEL_COUNT) return 0;
  return current[index];
}
