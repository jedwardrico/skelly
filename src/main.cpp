#include <Arduino.h>
#include <Wire.h>
#include <ArduinoJson.h>
#include "Config.h"
#include "ServoController.h"
#include "AudioPlayer.h"
#include "ControlAPI.h"
#ifdef ENABLE_BLUEPAD32
#include "GamepadController.h"
#endif

static ServoController servos;
static AudioPlayer audio;
static ControlAPI controlApi;
#ifdef ENABLE_BLUEPAD32
static GamepadController gamepad;
#endif

static void buildStatus(JsonObject &out) {
  out["playing"] = audio.isPlaying();
  out["file"] = audio.currentFile();
  out["jawLevel"] = audio.jawLevel();
  JsonObject servoAngles = out["servos"].to<JsonObject>();
  for (size_t i = 0; i < SERVO_CHANNEL_COUNT; i++) {
    servoAngles[SERVO_CHANNELS[i].name] = servos.currentAngle(SERVO_CHANNELS[i].channel);
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n[Skelly] booting");

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  servos.begin();

  if (!audio.begin()) {
    Serial.println("[Skelly] audio init failed - continuing without playback");
  }

  controlApi.onPlayCommand([](const String &file) {
    String path = file.startsWith("/") ? file : String(AUDIO_DIR) + "/" + file;
    return audio.play(path);
  });
  controlApi.onStopCommand([]() { audio.stop(); });
  controlApi.onServoCommand([](const String &name, float angle) {
    return servos.setAngle(name.c_str(), angle);
  });
  controlApi.onStatusRequest(buildStatus);
  controlApi.begin();

#ifdef ENABLE_BLUEPAD32
  gamepad.begin(&servos, &audio);
  Serial.println("[Skelly] BluePad32 gamepad support enabled");
#endif

  Serial.println("[Skelly] ready");
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
  if (audio.isPlaying() && !jawOverridden) {
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
      servos.setAngle(JAW_SERVO_NAME, angle);
    }
  }
}
