#pragma once

#include <AudioOutputI2S.h>

// AudioOutputI2S subclass that taps every sample on its way to the MAX98357A
// to update a shared, asymmetric envelope follower (fast attack, slower
// release - mouths snap open and drift shut). AudioPlayer reads the result
// as jawLevel(); it's declared here rather than as an AudioPlayer method
// because ConsumeSample() must be a plain virtual override with the exact
// signature ESP8266Audio expects.
class JawSyncOutput : public AudioOutputI2S {
public:
  bool ConsumeSample(int16_t sample[2]) override;
  bool SetRate(int hz) override {
    rate = hz;
    return AudioOutputI2S::SetRate(hz);
  }

  // Playback stats for diagnosing underruns: samples actually handed to I2S
  // and the sample rate the decoder asked for.
  uint32_t samplesConsumed = 0;
  int rate = 0;
};
