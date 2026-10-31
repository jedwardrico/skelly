#include "AudioPlayer.h"
#include "JawSyncOutput.h"
#include "SkellyLog.h"
#include <AudioGeneratorMP3.h>
#include <AudioGeneratorWAV.h>
#include <AudioFileSourceLittleFS.h>
#include <LittleFS.h>
#include <Preferences.h>

volatile float g_jawEnvelope = 0.0f;

static const char *GAIN_PREFS_NAMESPACE = "audio";
static const char *GAIN_PREFS_KEY = "gain";

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
  {
    Preferences prefs;
    prefs.begin(GAIN_PREFS_NAMESPACE, /*readOnly=*/true);
    currentGain = constrain(prefs.getFloat(GAIN_PREFS_KEY, AUDIO_DEFAULT_GAIN), 0.0f, 1.0f);
    prefs.end();
  }
  s_out->SetGain(currentGain * AUDIO_MAX_GAIN);

#if I2S_AMP_ENABLE_PIN >= 0
  pinMode(I2S_AMP_ENABLE_PIN, OUTPUT);
  digitalWrite(I2S_AMP_ENABLE_PIN, HIGH); // enable MAX98357A output
#endif

  lock = xSemaphoreCreateMutex();
  cmdMutex = xSemaphoreCreateMutex();
  cmdDone = xSemaphoreCreateBinary();
  // Core 0, not core 1 where loop() runs: a servo write blocks its core for ~40ms,
  // which would starve decoding and the I2S refill interrupt (attached to the core
  // that creates the channel - see runOnAudioTask()) and garble 44.1 kHz audio.
  // WiFi (priority 23) can still preempt it briefly; the I2S queue easily covers that.
  xTaskCreatePinnedToCore(taskEntry, "audio", 10240, this, AUDIO_TASK_PRIORITY, nullptr, 0);

  return true;
}

void AudioPlayer::taskEntry(void *arg) {
  AudioPlayer *self = static_cast<AudioPlayer *>(arg);
  for (;;) {
    if (self->cmd != CMD_NONE) {
      self->runCommand();
    } else {
      self->pump();
    }
    vTaskDelay(self->playing ? 1 : 5 / portTICK_PERIOD_MS);
  }
}

void AudioPlayer::setGain(float gain) {
  currentGain = constrain(gain, 0.0f, 1.0f);
  if (s_out) s_out->SetGain(currentGain * AUDIO_MAX_GAIN);
  Preferences prefs;
  prefs.begin(GAIN_PREFS_NAMESPACE, /*readOnly=*/false);
  prefs.putFloat(GAIN_PREFS_KEY, currentGain);
  prefs.end();
}

float AudioPlayer::jawLevel() const {
  return g_jawEnvelope;
}

void AudioPlayer::cleanup() {
  if (generator && s_out) {
    // Wall-clock time well above audio time means the I2S queue ran dry
    // (garbled playback), so log both.
    uint32_t wallMs = millis() - playStartMs;
    uint32_t audioMs = s_out->rate > 0 ? (uint32_t)((uint64_t)s_out->samplesConsumed * 1000 / s_out->rate) : 0;
    SkellyLog.printf("[AudioPlayer] done %s: %u ms audio @ %d Hz in %u ms wall\n", currentPath.c_str(),
                     (unsigned)audioMs, s_out->rate, (unsigned)wallMs);
  }
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
  playing = false;
  g_jawEnvelope = 0.0f;
}

bool AudioPlayer::play(const String &path) {
  return runOnAudioTask(CMD_PLAY, path);
}

bool AudioPlayer::runOnAudioTask(Cmd c, const String &path) {
  if (!cmdMutex || !cmdDone) return false;
  xSemaphoreTake(cmdMutex, portMAX_DELAY);
  xSemaphoreTake(cmdDone, 0); // drop a stale completion from a timed-out call
  cmdPath = path;
  cmdResult = false;
  cmd = c;
  bool finished = xSemaphoreTake(cmdDone, pdMS_TO_TICKS(3000)) == pdTRUE;
  bool ok = finished && cmdResult;
  xSemaphoreGive(cmdMutex);
  return ok;
}

// Runs on the audio task: stop whatever is playing, then start cmdPath if asked.
void AudioPlayer::runCommand() {
  xSemaphoreTake(lock, portMAX_DELAY);
  cleanup();
  bool ok = true;
  if (cmd == CMD_PLAY) {
    if (!LittleFS.exists(cmdPath)) {
      SkellyLog.printf("[AudioPlayer] file not found: %s\n", cmdPath.c_str());
      ok = false;
    } else {
      ok = startLocked(cmdPath);
    }
  }
  xSemaphoreGive(lock);
  cmdResult = ok;
  cmd = CMD_NONE;
  xSemaphoreGive(cmdDone);
}

// Starts playback of path; caller holds lock and has already cleaned up.
bool AudioPlayer::startLocked(const String &path) {

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

  generator->RegisterStatusCB(decoderStatus, nullptr);
  s_out->samplesConsumed = 0;
  s_out->rate = 0;
  playStartMs = millis();

  if (!generator->begin(file, s_out)) {
    SkellyLog.printf("[AudioPlayer] failed to start: %s\n", path.c_str());
    cleanup();
    return false;
  }

  currentPath = path;
  playing = true;
  return true;
}

void AudioPlayer::stop() {
  runOnAudioTask(CMD_STOP, String());
}

AudioPlayer::DeleteResult AudioPlayer::deleteClip(const String &path) {
  if (!lock) return DeleteResult::Failed;
  xSemaphoreTake(lock, portMAX_DELAY);
  DeleteResult result;
  // Compared under the lock so the clip can't start playing between the check
  // and the remove.
  if (generator && currentPath == path) {
    result = DeleteResult::Playing;
  } else if (!LittleFS.exists(path)) {
    result = DeleteResult::NotFound;
  } else {
    result = LittleFS.remove(path) ? DeleteResult::Deleted : DeleteResult::Failed;
  }
  xSemaphoreGive(lock);
  return result;
}

String AudioPlayer::currentFile() const {
  if (!lock) return String();
  xSemaphoreTake(lock, portMAX_DELAY);
  String copy = currentPath;
  xSemaphoreGive(lock);
  return copy;
}

void AudioPlayer::pump() {
  // If a command holds the lock, skip this step; the task comes back in a tick.
  if (xSemaphoreTake(lock, 0) != pdTRUE) return;
  if (generator) {
    if (!generator->isRunning() || !generator->loop()) {
      // Playback finished (or errored); tear down so isPlaying() reflects it
      // immediately.
      cleanup();
    }
  }
  xSemaphoreGive(lock);
}
