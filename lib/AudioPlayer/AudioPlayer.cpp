#include "AudioPlayer.h"
#include "JawSyncOutput.h"
#include "SkellyLog.h"
#include <AudioGeneratorMP3.h>
#include <AudioGeneratorWAV.h>
#include <AudioFileSourceLittleFS.h>
#include <LittleFS.h>

volatile float g_jawEnvelope = 0.0f;

static JawSyncOutput *s_out = nullptr;

// Decoder warnings/errors (e.g. MP3 sync lost, bad frame) land in the log.
static void decoderStatus(void *, int code, const char *msg) {
  SkellyLog.printf("[AudioPlayer] decoder: %d %s\n", code, msg);
}

// Per-task CPU accounting, so the log can name whatever is hogging the CPU
// while audio plays. Only compiled in when FreeRTOS run-time stats are enabled.
#if (configGENERATE_RUN_TIME_STATS == 1) && (configUSE_TRACE_FACILITY == 1)
#define SKELLY_TASK_STATS 1
static const UBaseType_t kStatsMaxTasks = 40;
static TaskStatus_t s_statsBefore[kStatsMaxTasks];
static TaskStatus_t s_statsAfter[kStatsMaxTasks];
static UBaseType_t s_statsBeforeN = 0;
static uint32_t s_statsBeforeTotal = 0;

static void statsSnapshotStart() {
  s_statsBeforeN = uxTaskGetSystemState(s_statsBefore, kStatsMaxTasks, &s_statsBeforeTotal);
}

static void statsLogBusiest() {
  uint32_t total = 0;
  UBaseType_t n = uxTaskGetSystemState(s_statsAfter, kStatsMaxTasks, &total);
  uint32_t span = total - s_statsBeforeTotal;
  if (n == 0 || s_statsBeforeN == 0 || span == 0) {
    SkellyLog.println("[AudioPlayer] cpu: task stats unavailable (too many tasks?)");
    return;
  }
  uint32_t delta[kStatsMaxTasks];
  for (UBaseType_t i = 0; i < n; i++) {
    uint32_t prev = 0;
    for (UBaseType_t j = 0; j < s_statsBeforeN; j++) {
      if (s_statsBefore[j].xHandle == s_statsAfter[i].xHandle) {
        prev = (uint32_t)s_statsBefore[j].ulRunTimeCounter;
        break;
      }
    }
    delta[i] = (uint32_t)s_statsAfter[i].ulRunTimeCounter - prev;
  }
  // Six busiest tasks, as % of the elapsed run-time counter (idle tasks included).
  String line = "[AudioPlayer] cpu:";
  for (int k = 0; k < 6; k++) {
    int best = -1;
    for (UBaseType_t i = 0; i < n; i++) {
      if (delta[i] && (best < 0 || delta[i] > delta[best])) best = (int)i;
    }
    if (best < 0) break;
    line += String(" ") + s_statsAfter[best].pcTaskName + "(p" +
            String((unsigned)s_statsAfter[best].uxCurrentPriority) + ")=" +
            String((unsigned)((uint64_t)delta[best] * 100 / span)) + "%";
    delta[best] = 0;
  }
  SkellyLog.println(line.c_str());
}
#else
static void statsSnapshotStart() {}
static void statsLogBusiest() {
  SkellyLog.println("[AudioPlayer] cpu: per-task stats not enabled in this FreeRTOS build");
}
#endif

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

  lock = xSemaphoreCreateMutex();
  cmdMutex = xSemaphoreCreateMutex();
  cmdDone = xSemaphoreCreateBinary();
  // Core 0, not core 1 where loop() runs: measured, loop() runs flat out on core 1
  // and blocks even a higher-priority task there for ~40ms at a time (servo
  // PWM writes during jaw sync are the suspect), while core 0 is ~97% idle.
  // WiFi (priority 23) still preempts it, which is fine - it sleeps a tick between
  // steps and the I2S queue holds far more than a WiFi burst.
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
    uint32_t t0 = micros();
    vTaskDelay(self->playing ? 1 : 5 / portTICK_PERIOD_MS);
    if (self->playing) {
      uint32_t slept = micros() - t0;
      self->sleepCount++;
      self->sleepUsTotal += slept;
      if (slept > self->sleepUsMax) self->sleepUsMax = slept;
    }
  }
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
    // Where did the time go? generator = decode+output work inside
    // generator->loop(); rejected = times the I2S queue was full (a high count
    // with low generator time means the amp is the bottleneck, not the CPU).
    SkellyLog.printf(
        "[AudioPlayer] timing: cpu %u MHz, %u loop calls, %u ms in generator, %u ms elsewhere, %u rejected samples\n",
        (unsigned)getCpuFrequencyMhz(), (unsigned)loopCalls, (unsigned)(generatorUs / 1000),
        (unsigned)(wallMs - generatorUs / 1000), (unsigned)s_out->rejected);
    // A 1-tick sleep should last ~1 ms. Much longer means the audio task isn't
    // getting the CPU back (starved by a higher-priority task) or the tick is slow.
    SkellyLog.printf("[AudioPlayer] task: tick %u Hz, prio %u, %u sleeps, avg %u us, max %u us\n",
                     (unsigned)configTICK_RATE_HZ, (unsigned)uxTaskPriorityGet(nullptr),
                     (unsigned)sleepCount, (unsigned)(sleepCount ? sleepUsTotal / sleepCount : 0),
                     (unsigned)sleepUsMax);
    statsLogBusiest();
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
  statsSnapshotStart();
  playStartMs = lastLoopMs = millis();
  maxLoopGapMs = 0;
  loopCalls = 0;
  generatorUs = 0;
  sleepCount = sleepUsTotal = sleepUsMax = 0;
  s_out->rejected = 0;

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

String AudioPlayer::currentFile() const {
  if (!lock) return String();
  xSemaphoreTake(lock, portMAX_DELAY);
  String copy = currentPath;
  xSemaphoreGive(lock);
  return copy;
}

void AudioPlayer::pump() {
  // If play()/stop() holds the lock, skip this step; the task comes back in a tick.
  if (xSemaphoreTake(lock, 0) != pdTRUE) return;
  if (!generator) {
    xSemaphoreGive(lock);
    return;
  }

  uint32_t now = millis();
  if (now - lastLoopMs > maxLoopGapMs) maxLoopGapMs = now - lastLoopMs;
  lastLoopMs = now;

  if (generator->isRunning()) {
    uint32_t t0 = micros();
    bool more = generator->loop();
    generatorUs += micros() - t0;
    loopCalls++;
    if (!more) {
      // Playback finished (or errored) on this call; tear down so isPlaying()
      // reflects it immediately instead of one loop() iteration late.
      cleanup();
    }
  } else {
    cleanup();
  }
  xSemaphoreGive(lock);
}
