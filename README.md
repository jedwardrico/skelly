# Skelly

Animatronic talking skeleton, driven by an ESP32.

- Servos (via a PCA9685) move the jaw, neck, and eyes.
- A MAX98357A I2S amplifier plays speech clips, and the jaw is driven live
  off the audio's own volume envelope - no pre-baked mouth timing needed.
- A WiFi JSON/WebSocket control API is the integration point for the
  React Native app (`app/`).
- An 8BitDo Ultimate controller, via
  [BluePad32](https://bluepad32.readthedocs.io/en/latest/), is planned for
  live puppeteering - scaffolded but not wired up yet (see
  `docs/BLUEPAD32.md`).

## Hardware

- ESP32 dev board (ESP32-WROOM-32 recommended)
- PCA9685 16-channel PWM/servo driver
- MAX98357A I2S mono amplifier + small speaker
- 3-5+ hobby servos for jaw/neck/eyes
- 5V supply for servos and amp, separate from the ESP32's own power

Full wiring and pinout: [`docs/WIRING.md`](docs/WIRING.md).

## Firmware layout

```
platformio.ini             two envs: esp32dev (default, builds today) and
                            esp32_bluepad32 (scaffold, see docs/BLUEPAD32.md)
include/Config.h            all pins + named servo channel table
include/Secrets.h.example   copy to Secrets.h and fill in WiFi creds
src/main.cpp                wires the modules together
lib/ServoController/        PCA9685 servo control, by name, non-blocking moves
lib/AudioPlayer/            MAX98357A I2S playback + audio-envelope jaw sync
lib/ControlAPI/             WiFi + REST/WebSocket JSON control surface
lib/GamepadController/      BluePad32 scaffold (compiles to nothing by default)
data/audio/                 drop .mp3/.wav speech clips here
docs/                       architecture, wiring, API reference, BluePad32 setup
app/                        React Native (Expo) control app, see app/README.md
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how the pieces fit
together, [`docs/API.md`](docs/API.md) for the control API the app talks to,
and [`app/README.md`](app/README.md) for the app itself.

## Getting started

Requires [PlatformIO](https://platformio.org/) (CLI or the VS Code
extension).

1. `cp include/Secrets.h.example include/Secrets.h` and fill in your WiFi
   credentials (or leave them as placeholders - Skelly falls back to hosting
   its own `Skelly-Setup` access point if it can't join your network).
2. Wire everything per [`docs/WIRING.md`](docs/WIRING.md), and adjust
   `SERVO_CHANNELS` in `include/Config.h` to match your servo rig.
3. Drop a couple of `.mp3` (or `.wav`) speech clips into `data/audio/`.
4. Build, upload the filesystem image, then upload the firmware:
   ```
   pio run --target uploadfs
   pio run --target upload
   pio device monitor
   ```
5. Watch the serial monitor for the IP address it connects with, then try:
   ```
   curl http://<ip>/api/status
   curl -X POST http://<ip>/api/play -d '{"file":"hello.mp3"}'
   ```

## Roadmap

- [x] Servo control (PCA9685, named channels, non-blocking eased moves)
- [x] Speech playback (MAX98357A, MP3/WAV, audio-synced jaw)
- [x] WiFi JSON/WebSocket control API
- [x] React Native app consuming the control API, with on-device TTS
  (see [`app/README.md`](app/README.md))
- [x] File upload endpoint for pushing new clips over WiFi instead of USB
- [ ] BluePad32 + 8BitDo Ultimate controller support
  (see [`docs/BLUEPAD32.md`](docs/BLUEPAD32.md) for what's already
  scaffolded and what's left)
