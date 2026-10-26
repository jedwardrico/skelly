#include <Arduino.h>
#include <ArduinoJson.h>
#include "Config.h"
#include "ServoController.h"
#include "AudioPlayer.h"
#include "ControlAPI.h"
#include "EyeAnimator.h"
#ifdef ENABLE_BLUEPAD32
#include "GamepadController.h"
#endif

static ServoController servos;
static AudioPlayer audio;
static ControlAPI controlApi;
static EyeAnimator eyes;
#ifdef ENABLE_BLUEPAD32
static GamepadController gamepad;
#endif

static void buildStatus(JsonObject &out) {
  out["playing"] = audio.isPlaying();
  out["file"] = audio.currentFile();
  out["jawLevel"] = audio.jawLevel();
  JsonObject servoAngles = out["servos"].to<JsonObject>();
  JsonObject servoZeros = out["servoZero"].to<JsonObject>();
  for (size_t i = 0; i < SERVO_CHANNEL_COUNT; i++) {
    servoAngles[SERVO_CHANNELS[i].name] = servos.currentAngle((int)i);
    servoZeros[SERVO_CHANNELS[i].name] = servos.restAngle(SERVO_CHANNELS[i].name);
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);
  SkellyLog.println("\n[Skelly] booting");

  servos.begin();

  if (!audio.begin()) {
    SkellyLog.println("[Skelly] audio init failed - continuing without playback");
  }

  controlApi.onPlayCommand([](const String &file) {
    String path = file.startsWith("/") ? file : String(AUDIO_DIR) + "/" + file;
    return audio.play(path);
  });
  controlApi.onStopCommand([]() { audio.stop(); });
  controlApi.onDeleteFile([](const String &path) {
    switch (audio.deleteClip(path)) {
      case AudioPlayer::DeleteResult::Deleted: return ControlAPI::DeleteResult::Deleted;
      case AudioPlayer::DeleteResult::NotFound: return ControlAPI::DeleteResult::NotFound;
      case AudioPlayer::DeleteResult::Playing: return ControlAPI::DeleteResult::Busy;
      default: return ControlAPI::DeleteResult::Failed;
    }
  });
  controlApi.onServoCommand([](const String &name, float angle) {
    return servos.setAngle(name.c_str(), angle);
  });
  controlApi.onServoZeroSet([](const String &name, float angle) {
    return servos.setRestAngle(name.c_str(), angle);
  });
  controlApi.onServoZeroReset([](const String &name) {
    return servos.resetRestAngle(name.c_str());
  });
  controlApi.onStatusRequest(buildStatus);
  controlApi.begin();

  eyes.begin(&servos);

#ifdef ENABLE_BLUEPAD32
  gamepad.begin(&servos, &audio);
  SkellyLog.println("[Skelly] BluePad32 gamepad support enabled");
#endif

  SkellyLog.println("[Skelly] ready");
}

void loop() {
  audio.loop();
  servos.update();
  controlApi.loop();
#ifdef ENABLE_BLUEPAD32
  gamepad.update();
#endif

  // Audio-driven jaw sync: skip while a gamepad is actively puppeteering the
  // jaw so the two control paths don't fight (GamepadController takes the
  // jaw directly via setAngle() while L1 is held).
  bool jawOverridden = false;
#ifdef ENABLE_BLUEPAD32
  jawOverridden = g_jawOverride;
#endif
  bool playing = audio.isPlaying();
  if (playing && !jawOverridden) {
    float level = audio.jawLevel();
    const ServoChannelDef *jaw = nullptr;
    for (size_t i = 0; i < SERVO_CHANNEL_COUNT; i++) {
      if (strcmp(SERVO_CHANNELS[i].name, JAW_SERVO_NAME) == 0) {
        jaw = &SERVO_CHANNELS[i];
        break;
      }
    }
    if (jaw) {
      float angle = jaw->minAngle + level * (jaw->maxAngle - jaw->minAngle);
      // A servo write blocks this core for ~40ms, so cap the jaw to ~16 updates/s
      // and ignore sub-degree changes; plenty for a mouth, and it keeps loop()
      // (and everything sharing its core) responsive.
      static uint32_t lastJawMs = 0;
      static float lastJawAngle = -1000.0f;
      uint32_t nowMs = millis();
      if (nowMs - lastJawMs >= JAW_UPDATE_MIN_INTERVAL_MS && fabsf(angle - lastJawAngle) >= 1.0f) {
        servos.setAngle(JAW_SERVO_NAME, angle);
        lastJawMs = nowMs;
        lastJawAngle = angle;
      }
    }
  }

  eyes.update(playing);
}
