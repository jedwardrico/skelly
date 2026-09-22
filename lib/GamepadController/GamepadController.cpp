#include "GamepadController.h"

#ifdef ENABLE_BLUEPAD32

// NOTE: verify these against the Bluepad32 version pulled in by
// docs/BLUEPAD32.md - the controller API has been stable as ControllerPtr /
// BP32.setup() / BP32.update() for a while, but older tutorials use the
// pre-rename GamepadPtr API. Check
// https://bluepad32.readthedocs.io/en/latest/plat_arduino/ for the version
// you actually pull in.
#include <Bluepad32.h>
#include "Config.h"

static ServoController *s_servos = nullptr;
static AudioPlayer *s_audio = nullptr;
static ControllerPtr s_controllers[BP32_MAX_GAMEPADS];
volatile bool g_jawOverride = false;

// Speech clips triggered by face buttons. Rename/extend to match whatever
// you've dropped in data/audio/.
static const char *CLIP_A = "/audio/hello.mp3";
static const char *CLIP_B = "/audio/laugh.mp3";
static const char *CLIP_X = "/audio/hmm.mp3";
static const char *CLIP_Y = "/audio/goodbye.mp3";

static void onConnectedController(ControllerPtr ctl) {
  for (int i = 0; i < BP32_MAX_GAMEPADS; i++) {
    if (s_controllers[i] == nullptr) {
      Serial.printf("[Gamepad] controller connected, slot %d\n", i);
      s_controllers[i] = ctl;
      return;
    }
  }
  Serial.println("[Gamepad] no free slot for new controller");
}

static void onDisconnectedController(ControllerPtr ctl) {
  for (int i = 0; i < BP32_MAX_GAMEPADS; i++) {
    if (s_controllers[i] == ctl) {
      Serial.printf("[Gamepad] controller disconnected, slot %d\n", i);
      s_controllers[i] = nullptr;
      return;
    }
  }
}

void GamepadController::begin(ServoController *servos, AudioPlayer *audio) {
  s_servos = servos;
  s_audio = audio;
  BP32.setup(&onConnectedController, &onDisconnectedController);
  BP32.enableVirtualDevice(false); // ignore the virtual gamepad BluePad32 can emulate over BLE
}

static float mapAxis(int32_t raw, float minAngle, float maxAngle) {
  // BluePad32 axes are roughly -512..512.
  float t = (raw + 512) / 1024.0f;
  return minAngle + t * (maxAngle - minAngle);
}

void GamepadController::update() {
  if (!BP32.update()) return;

  for (int i = 0; i < BP32_MAX_GAMEPADS; i++) {
    ControllerPtr ctl = s_controllers[i];
    if (!ctl || !ctl->isConnected() || !ctl->hasData() || !ctl->isGamepad()) continue;

    // Right stick: neck pan/tilt, always live.
    s_servos->setTarget("neck_pan", mapAxis(ctl->axisRX(), 30, 150), 200);
    s_servos->setTarget("neck_tilt", mapAxis(ctl->axisRY(), 60, 120), 200);

    // Hold L1 to puppeteer the jaw directly with the left stick; otherwise
    // the jaw stays under audio-envelope control from main.cpp.
    g_jawOverride = ctl->l1();
    if (g_jawOverride) {
      s_servos->setAngle("jaw", mapAxis(ctl->axisY(), 0, 55));
    }

    if (ctl->a()) s_audio->play(CLIP_A);
    if (ctl->b()) s_audio->play(CLIP_B);
    if (ctl->x()) s_audio->play(CLIP_X);
    if (ctl->y()) s_audio->play(CLIP_Y);

    if (ctl->r1()) s_audio->stop();
    if (ctl->miscHome()) s_servos->goToRest();
  }
}

#endif // ENABLE_BLUEPAD32
