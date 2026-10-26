#pragma once

#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <AudioOutputI2S.h>
#include <AudioGenerator.h>
#include <AudioFileSource.h>
#include "Config.h"

// Drives the MAX98357A over I2S and plays WAV/MP3 files from LittleFS.
// While a file plays, a running envelope follower on the raw samples exposes
// jawLevel() (0.0-1.0), which main.cpp maps onto the jaw servo so the mouth
// flaps in time with whatever is actually coming out of the speaker - no
// pre-baked viseme/timing data required.
//
// Decoding runs in its own FreeRTOS task. The main loop() was measured taking
// ~40ms per pass (WiFi/web server, servos, status broadcasts), but the I2S
// queue only holds a few tens of ms of audio, so feeding it from loop() left
// gaps and played 44.1 kHz audio at less than half speed. A dedicated task
// feeds the queue every millisecond no matter what loop() is doing.
class AudioPlayer {
public:
  bool begin();
  // Kept for the main loop's call site; decoding happens in the audio task.
  void loop() {}

  // path is a LittleFS path, e.g. "/audio/hello.mp3". Supports .mp3 and .wav
  // by extension. Stops any currently playing file first.
  bool play(const String &path);
  void stop();

  bool isPlaying() const { return playing; }
  String currentFile() const;

  // Current smoothed audio envelope, 0.0 (silence) - 1.0 (full scale).
  float jawLevel() const;

  void setGain(float gain);

private:
  AudioFileSource *file = nullptr;
  AudioGenerator *generator = nullptr;
  String currentPath;
  SemaphoreHandle_t lock = nullptr; // guards file/generator/currentPath between the audio task and callers
  volatile bool playing = false;
  uint32_t playStartMs = 0;
  uint32_t lastLoopMs = 0;
  uint32_t maxLoopGapMs = 0;
  uint32_t loopCalls = 0;
  uint32_t generatorUs = 0; // time spent inside generator->loop()

  void cleanup(); // caller must hold lock
  bool startLocked(const String &path); // caller must hold lock
  void pump();    // one decode step; run by the audio task
  static void taskEntry(void *arg);
};

// Exposed so ConsumeSample() can update the shared envelope value; see
// AudioPlayer.cpp for why this isn't a plain member callback.
extern volatile float g_jawEnvelope;
