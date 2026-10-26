#pragma once

#include <AudioOutputI2S.h>

// AudioOutputI2S subclass that taps every sample on its way to the MAX98357A
// to update a shared, asymmetric envelope follower (fast attack, slower
// release - mouths snap open and drift shut). AudioPlayer reads the result
// as jawLevel(); it's declared here rather than as an AudioPlayer method
// because ConsumeSample() must be a plain virtual override with the exact
// signature ESP8266Audio expects.
//
// It also batches the I2S writes. Stock ESP32 AudioOutputI2S issues one
// i2s_channel_write() driver call per sample, which tops out around 19k
// samples/s - fine for 16 kHz clips, but 44.1 kHz audio (what ElevenLabs
// returns) plays at less than half speed and garbles. Samples are staged here
// and handed to the driver a block at a time.
class JawSyncOutput : public AudioOutputI2S {
public:
  bool begin() override;
  bool ConsumeSample(int16_t sample[2]) override;
  bool stop() override;
  bool SetRate(int hz) override {
    rate = hz;
    return AudioOutputI2S::SetRate(hz);
  }

  // Playback stats for diagnosing underruns: samples actually accepted and
  // the sample rate the decoder asked for.
  uint32_t samplesConsumed = 0;
  int rate = 0;

private:
  static constexpr size_t kStageFrames = 128;
  uint32_t stage[kStageFrames];
  size_t staged = 0;

  // Hands staged frames to the I2S driver, waiting up to timeoutMs for DMA
  // space (0 = don't wait). Keeps whatever didn't fit for the next call.
  void flushStage(uint32_t timeoutMs);
};
