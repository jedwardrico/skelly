#include "JawSyncOutput.h"
#include "Config.h"
#include "AudioPlayer.h"

bool JawSyncOutput::begin() {
  staged = 0;
  return AudioOutputI2S::begin();
}

void JawSyncOutput::flushStage(uint32_t timeoutMs) {
  if (!staged || !i2sOn) return;
  size_t written = 0;
  i2s_channel_write(_tx_handle, stage, staged * sizeof(uint32_t), &written,
                    pdMS_TO_TICKS(timeoutMs));
  size_t frames = written / sizeof(uint32_t);
  if (frames >= staged) {
    staged = 0;
  } else if (frames > 0) {
    memmove(stage, stage + frames, (staged - frames) * sizeof(uint32_t));
    staged -= frames;
  }
}

bool JawSyncOutput::ConsumeSample(int16_t sample[2]) {
  if (!i2sOn) return false;

  // Make room first; if the DMA queue is full the decoder just retries this
  // same sample on its next loop().
  if (staged >= kStageFrames) flushStage(0);
  if (staged >= kStageFrames) return false;

  float magnitude = abs(sample[0]) / 32768.0f;
  float alpha = (magnitude > g_jawEnvelope) ? JAW_ENVELOPE_ATTACK : JAW_ENVELOPE_RELEASE;
  g_jawEnvelope += (magnitude - g_jawEnvelope) * alpha;

  // Same shaping the stock ConsumeSample() applies before its write.
  int16_t ms[2] = {sample[0], sample[1]};
  MakeSampleStereo16(ms);
  if (mono) {
    int32_t ttl = ms[LEFTCHANNEL] + ms[RIGHTCHANNEL];
    ms[LEFTCHANNEL] = ms[RIGHTCHANNEL] = (ttl >> 1) & 0xffff;
  }
  stage[staged++] = ((uint32_t)(uint16_t)Amplify(ms[RIGHTCHANNEL]) << 16) |
                    (uint16_t)Amplify(ms[LEFTCHANNEL]);
  samplesConsumed++;
  return true;
}

bool JawSyncOutput::stop() {
  flushStage(50); // don't clip the tail of the clip
  staged = 0;
  return AudioOutputI2S::stop();
}
