#include "AudioPlayer.h"
#include "JawSyncOutput.h"
#include "SkellyLog.h"
#include <AudioGeneratorMP3.h>
#include <AudioGeneratorWAV.h>
#include <AudioFileSourceBuffer.h>
#include <AudioFileSourceLittleFS.h>
#include <LittleFS.h>

volatile float g_jawEnvelope = 0.0f;

static JawSyncOutput *s_out = nullptr;

// Decoder warnings/errors (e.g. MP3 sync lost, bad frame) land in the log.
static void decoderStatus(void *, int code, const char *msg) {
  SkellyLog.printf("[AudioPlayer] decoder: %d %s\n", code, msg);
}

bool AudioPlayer::begin() {
  if (!LittleFS.begin(true)) {
    SkellyLog.println("[AudioPlayer] LittleFS mount failed");
    return false;
  }

  // A fresh filesystem (or one flashed from an empty data/audio/) has no
  // AUDIO_DIR, and LittleFS can't create files inside a missing directory.
  if (!LittleFS.exists(AUDIO_DIR) && !LittleFS.mkdir(AUDIO_DIR)) {
    SkellyLog.printf("[AudioPlayer] couldn't create %s\n", AUDIO_DIR);
  }

  s_out = new JawSyncOutput();
  s_out->SetBuffers(AUDIO_I2S_DMA_BUFFERS, AUDIO_I2S_DMA_BUFFER_BYTES);
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
  if (generator && s_out) {
    // If wall-clock time is well above audio time, the decoder couldn't keep
    // the I2S queue full - that's what garbled playback sounds like.
    uint32_t wallMs = millis() - playStartMs;
    uint32_t audioMs = s_out->rate > 0 ? (uint32_t)((uint64_t)s_out->samplesConsumed * 1000 / s_out->rate) : 0;
    SkellyLog.printf(
        "[AudioPlayer] done %s: %u ms audio @ %d Hz in %u ms wall, longest loop gap %u ms, free heap %u, free psram %u\n",
        currentPath.c_str(), (unsigned)audioMs, s_out->rate, (unsigned)wallMs,
        (unsigned)maxLoopGapMs, (unsigned)ESP.getFreeHeap(), (unsigned)ESP.getFreePsram());
  }
  if (generator) {
    generator->stop();
    delete generator;
    generator = nullptr;
  }
  if (buffered) {
    delete buffered;
    buffered = nullptr;
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
    SkellyLog.printf("[AudioPlayer] file not found: %s\n", path.c_str());
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
    SkellyLog.printf("[AudioPlayer] unsupported file type: %s\n", path.c_str());
    cleanup();
    return false;
  }

  // Unbuffered, the MP3 decoder issues many tiny LittleFS reads between
  // frames; a slow one starves the I2S DMA queue and the speech garbles.
  // Read ahead so the decoder always finds its next frame in RAM.
  buffered = new AudioFileSourceBuffer(file, AUDIO_FILE_BUFFER_BYTES);

  generator->RegisterStatusCB(decoderStatus, nullptr);
  s_out->samplesConsumed = 0;
  s_out->rate = 0;
  playStartMs = lastLoopMs = millis();
  maxLoopGapMs = 0;

  if (!generator->begin(buffered, s_out)) {
    SkellyLog.printf("[AudioPlayer] failed to start: %s\n", path.c_str());
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

  uint32_t now = millis();
  if (now - lastLoopMs > maxLoopGapMs) maxLoopGapMs = now - lastLoopMs;
  lastLoopMs = now;

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
