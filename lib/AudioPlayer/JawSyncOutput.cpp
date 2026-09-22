#include "JawSyncOutput.h"
#include "Config.h"
#include "AudioPlayer.h"

bool JawSyncOutput::ConsumeSample(int16_t sample[2]) {
  float magnitude = abs(sample[0]) / 32768.0f;
  float alpha = (magnitude > g_jawEnvelope) ? JAW_ENVELOPE_ATTACK : JAW_ENVELOPE_RELEASE;
  g_jawEnvelope += (magnitude - g_jawEnvelope) * alpha;
  return AudioOutputI2S::ConsumeSample(sample);
}
