#pragma once

// Scaffold for driving the skull with an 8BitDo Ultimate controller over
// BluePad32 (https://bluepad32.readthedocs.io/en/latest/). This file only
// compiles when building the esp32_bluepad32 PlatformIO environment (see
// platformio.ini and docs/BLUEPAD32.md) - in the default esp32dev build,
// ENABLE_BLUEPAD32 is undefined and this whole file is a no-op.
#ifdef ENABLE_BLUEPAD32

#include "ServoController.h"
#include "AudioPlayer.h"

class GamepadController {
public:
  // servos/audio are owned by main.cpp; GamepadController just drives them.
  void begin(ServoController *servos, AudioPlayer *audio);
  void update();
};

// True while a controller is actively puppeteering the jaw (L1 held), so
// main.cpp's audio-envelope jaw sync can back off instead of fighting it.
extern volatile bool g_jawOverride;

#endif // ENABLE_BLUEPAD32
