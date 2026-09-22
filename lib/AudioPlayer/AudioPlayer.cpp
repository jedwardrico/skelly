#include "AudioPlayer.h"
#include "JawSyncOutput.h"
#include <AudioGeneratorMP3.h>
#include <AudioGeneratorWAV.h>
#include <AudioFileSourceLittleFS.h>
#include <LittleFS.h>

volatile float g_jawEnvelope = 0.0f;

static JawSyncOutput *s_out = nullptr;

bool AudioPlayer::begin() {
  if (!LittleFS.begin(true)) {
    Serial.println("[AudioPlayer] LittleFS mount failed");
    return false;
  }

  s_out = new JawSyncOutput();
  s_out->SetPinout(I2S_BCLK_PIN, I2S_LRC_PIN, I2S_DOUT_PIN);
  s_out->SetOutputModeMono(true);
  s_out->SetGain(AUDIO_DEFAULT_GAIN);

#if I2S_AMP_ENABLE_PIN >= 0
  pinMode(I2S_AMP_ENABLE_PIN, OUTPUT);
  digitalWrite(I2S_AMP_ENABLE_PIN, HIGH); // enable MAX98357A output
#endif

  return true;
}

void AudioPlayer::setGain(float gain) {
  if (s_out) s_out->SetGain(gain);
}

float AudioPlayer::jawLevel() const {
  return g_jawEnvelope;
}

void AudioPlayer::cleanup() {
  if (generator) {
    generator->stop();
    delete generator;
    generator = nullptr;
  }
  if (file) {
    delete file;
    file = nullptr;
  }
  currentPath = "";
  g_jawEnvelope = 0.0f;
}

bool AudioPlayer::play(const String &path) {
  stop();

  if (!LittleFS.exists(path)) {
    Serial.printf("[AudioPlayer] file not found: %s\n", path.c_str());
    return false;
  }

  file = new AudioFileSourceLittleFS(path.c_str());

  String lower = path;
  lower.toLowerCase();
  if (lower.endsWith(".mp3")) {
    generator = new AudioGeneratorMP3();
  } else if (lower.endsWith(".wav")) {
    generator = new AudioGeneratorWAV();
  } else {
    Serial.printf("[AudioPlayer] unsupported file type: %s\n", path.c_str());
    cleanup();
    return false;
  }

  if (!generator->begin(file, s_out)) {
    Serial.printf("[AudioPlayer] failed to start: %s\n", path.c_str());
    cleanup();
    return false;
  }

  currentPath = path;
  return true;
}

void AudioPlayer::stop() {
  cleanup();
}

bool AudioPlayer::isPlaying() const {
  return generator != nullptr && generator->isRunning();
}

void AudioPlayer::loop() {
  if (!generator) return;

  if (generator->isRunning()) {
    if (!generator->loop()) {
      // Playback finished (or errored) on this call; tear down so isPlaying()
      // reflects it immediately instead of one loop() iteration late.
      cleanup();
    }
  } else {
    cleanup();
  }
}
