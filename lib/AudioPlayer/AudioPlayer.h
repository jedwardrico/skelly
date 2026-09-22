#pragma once

#include <Arduino.h>
#include <AudioOutputI2S.h>
#include <AudioGenerator.h>
#include <AudioFileSource.h>
#include "Config.h"

// Drives the MAX98357A over I2S and plays WAV/MP3 files from LittleFS.
// While a file plays, a running envelope follower on the raw samples exposes
// jawLevel() (0.0-1.0), which main.cpp maps onto the jaw servo so the mouth
// flaps in time with whatever is actually coming out of the speaker - no
// pre-baked viseme/timing data required.
class AudioPlayer {
public:
  bool begin();
  void loop();

  // path is a LittleFS path, e.g. "/audio/hello.mp3". Supports .mp3 and .wav
  // by extension. Stops any currently playing file first.
  bool play(const String &path);
  void stop();

  bool isPlaying() const;
  String currentFile() const { return currentPath; }

  // Current smoothed audio envelope, 0.0 (silence) - 1.0 (full scale).
  float jawLevel() const;

  void setGain(float gain);

private:
  AudioFileSource *file = nullptr;
  AudioGenerator *generator = nullptr;
  String currentPath;

  void cleanup();
};

// Exposed so ConsumeSample() can update the shared envelope value; see
// AudioPlayer.cpp for why this isn't a plain member callback.
extern volatile float g_jawEnvelope;
