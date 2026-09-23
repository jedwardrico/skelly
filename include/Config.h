#pragma once

#include <Arduino.h>
#include "Secrets.h"

// ---------------------------------------------------------------------------
// Servo PWM (direct ESP32 GPIO, wired through the Freenove breakout board's
// terminal blocks - no PCA9685 or other I2C PWM driver involved)
// ---------------------------------------------------------------------------
#define SERVO_PWM_FREQ_HZ 50

// Pulse width range, in microseconds, for a typical analog hobby servo.
// Recalibrate per-servo if yours buzzes or doesn't reach its full range.
#define SERVO_PULSE_MIN_US 500
#define SERVO_PULSE_MAX_US 2500

// ---------------------------------------------------------------------------
// I2S bus (MAX98357A amplifier). Chosen to avoid the I2C pins above.
// ---------------------------------------------------------------------------
#define I2S_BCLK_PIN 26
#define I2S_LRC_PIN 25
#define I2S_DOUT_PIN 27
// Optional: MAX98357A SD pin wired to a GPIO instead of tied straight to
// 3.3V/GND, so firmware can mute the amp between lines. Set to -1 if you tied
// SD directly to a rail instead.
#define I2S_AMP_ENABLE_PIN 14

// ---------------------------------------------------------------------------
// Named servo channels, each driven straight off an ESP32 GPIO pin broken
// out on the Freenove breakout board's terminal blocks. Add/remove entries
// to match your skull's rig; everything else in the firmware (control API,
// gamepad scaffold) resolves servos by name through this table. Pick pins
// that avoid the I2S bus above, UART0 (0/1/3), the flash pins (6-11), and
// the strapping pins (0/2/5/12/15).
// ---------------------------------------------------------------------------
struct ServoChannelDef {
  const char *name;
  uint8_t pin;
  float minAngle;
  float maxAngle;
  float restAngle;
};

static const ServoChannelDef SERVO_CHANNELS[] = {
    {"jaw", 13, 0, 55, 0},
    {"neck_pan", 16, 30, 150, 90},
    {"neck_tilt", 17, 60, 120, 90},
    {"eye_pan", 18, 0, 180, 90},
    {"eye_tilt", 19, 0, 180, 90},
};
static const size_t SERVO_CHANNEL_COUNT = sizeof(SERVO_CHANNELS) / sizeof(SERVO_CHANNELS[0]);

// Which named channel the audio-envelope jaw sync drives.
#define JAW_SERVO_NAME "jaw"

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------
#define AUDIO_DIR "/audio"
// 0.0-1.0. MAX98357A has no analog volume pin, so gain is applied in software.
#define AUDIO_DEFAULT_GAIN 0.6f

// Jaw envelope follower: higher = snappier/twitchier, lower = smoother/laggier.
#define JAW_ENVELOPE_ATTACK 0.35f
#define JAW_ENVELOPE_RELEASE 0.08f

// ---------------------------------------------------------------------------
// WiFi / control API
// ---------------------------------------------------------------------------
#define WIFI_CONNECT_TIMEOUT_MS 15000
#define CONTROL_API_PORT 80
#define STATUS_BROADCAST_INTERVAL_MS 50 // ~20Hz jaw-level updates over WebSocket
