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

// The neck is a 3-servo rig: the head rotates around a single center pivot
// at the front of the neck, and `neck_left`/`neck_right` each push/pull a
// rod mounted on either side of that pivot. Driving them together nods the
// head around the pivot (pitch); driving them opposite amounts rolls it
// (tilt) - see lib/NeckMixer, which mixes a single pitch/roll pair down to
// these two raw channels. `neck_yaw` is a separate, unmixed servo that
// rotates the whole head assembly at the base.
static const ServoChannelDef SERVO_CHANNELS[] = {
    {"jaw", 13, 0, 30, 0},
    {"neck_left", 32, 60, 120, 90},
    {"neck_right", 33, 60, 120, 90},
    {"neck_yaw", 4, 30, 150, 90},
    {"eye_pan", 18, 0, 180, 90},
    {"eye_tilt", 19, 0, 180, 90},
};
static const size_t SERVO_CHANNEL_COUNT = sizeof(SERVO_CHANNELS) / sizeof(SERVO_CHANNELS[0]);

// Which named channel the audio-envelope jaw sync drives.
#define JAW_SERVO_NAME "jaw"
// Minimum gap between audio-driven jaw writes (each servo write blocks its core ~40ms).
#define JAW_UPDATE_MIN_INTERVAL_MS 60

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------
#define AUDIO_DIR "/audio"
// 0.0-1.0. MAX98357A has no analog volume pin, so gain is applied in software.
#define AUDIO_DEFAULT_GAIN 0.6f

// Deeper I2S DMA queue than the library default (5 x 2304 bytes, ~65ms at
// 44.1kHz stereo) so a busy main loop doesn't underrun the amp. Lower if RAM
// gets tight.
// FreeRTOS priority of the audio decode task (runs on core 0): below WiFi/lwIP,
// above everything else. It sleeps a tick between steps so others still run.
#define AUDIO_TASK_PRIORITY 5
#define AUDIO_I2S_DMA_BUFFERS 10
#define AUDIO_I2S_DMA_BUFFER_BYTES 2304

// Jaw / eye animation defaults. Every value here can be overridden at runtime
// from the app's setup screen (persisted in NVS) - see AnimationSettings.
//
// Jaw envelope follower time constants: lower = snappier/twitchier, higher =
// smoother/laggier. A slow release means that between quick syllables the jaw
// only partly closes instead of snapping shut.
#define JAW_ENVELOPE_ATTACK_MS 5.0f
#define JAW_ENVELOPE_RELEASE_MS 75.0f
// Raw speech peaks sit well below full scale, so boost the envelope before
// mapping to the jaw range (result is clamped to 1.0), then apply a sqrt-style
// curve so quiet syllables still open the mouth noticeably.
#define JAW_LEVEL_GAIN 4.0f
// While speech is above the silence threshold the jaw never drops below this
// fraction of its range, keeping it biased open between beats.
#define JAW_SPEECH_OPEN_FLOOR 0.35f
#define JAW_SILENCE_LEVEL 0.02f

// Eye animation while talking: "wander" = slower, wider glance; "dart" = quick,
// small saccade. Angles are +/- degrees around the eye's rest angle.
#define EYE_DART_CHANCE 0.5f
#define EYE_WANDER_PAN_DEG 30.0f
#define EYE_WANDER_TILT_DEG 18.0f
#define EYE_WANDER_SPEED_DPS 45.0f
#define EYE_DART_PAN_DEG 12.0f
#define EYE_DART_TILT_DEG 8.0f
#define EYE_DART_SPEED_DPS 220.0f
#define EYE_INTERVAL_MIN_MS 350.0f
#define EYE_INTERVAL_MAX_MS 1800.0f
#define EYE_REST_RETURN_SPEED_DPS 60.0f

// Neck animation while talking, same two move types as the eyes. Yaw is the
// base rotation; pitch (nod) and roll (tilt) are mixed down to the two
// push-rod servos by NeckMixer. Angles are +/- degrees around rest.
#define NECK_DART_CHANCE 0.3f
#define NECK_WANDER_YAW_DEG 25.0f
#define NECK_WANDER_PITCH_DEG 8.0f
#define NECK_WANDER_ROLL_DEG 6.0f
#define NECK_WANDER_SPEED_DPS 20.0f
#define NECK_DART_YAW_DEG 10.0f
#define NECK_DART_PITCH_DEG 6.0f
#define NECK_DART_ROLL_DEG 4.0f
#define NECK_DART_SPEED_DPS 90.0f
#define NECK_INTERVAL_MIN_MS 1500.0f
#define NECK_INTERVAL_MAX_MS 5000.0f
#define NECK_REST_RETURN_SPEED_DPS 30.0f

// ---------------------------------------------------------------------------
// WiFi / control API
// ---------------------------------------------------------------------------
#define WIFI_CONNECT_TIMEOUT_MS 15000
#define CONTROL_API_PORT 80
#define STATUS_BROADCAST_INTERVAL_MS 50 // ~20Hz jaw-level updates over WebSocket
#define LOG_BACKLOG_MAX_LINES 100       // lines returned by GET /api/logs
#define LOG_FRAMES_PER_LOOP 20          // max "log" WebSocket frames sent per loop()
