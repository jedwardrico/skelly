# Architecture

```
                         +--------------------+
                         |  React Native app  |
                         |      (app/)        |
                         +---------+----------+
                                   | WiFi: REST + WebSocket JSON
                                   v
+------------------+     +--------------------+     +-------------------+
| 8BitDo Ultimate   |     |   ESP32 firmware   |     |   PCA9685 (I2C)   |
| controller        +---->  (this repo)        +----->  -> servos       |
| (BluePad32, WIP)  |     |                    |     |  jaw/neck/eyes   |
+-------------------+     |  ServoController   |     +-------------------+
                          |  AudioPlayer       |
                          |  ControlAPI        |     +-------------------+
                          |  GamepadController +----->  MAX98357A (I2S) |
                          +--------------------+     |  -> speaker      |
                                                       +-------------------+
```

## Modules (`lib/`)

- **ServoController** - wraps the Adafruit PCA9685 driver. Servos are
  addressed by name (`SERVO_CHANNELS` in `include/Config.h`), each with its
  own min/max/rest angle. `setAngle()` jumps instantly; `setTarget()` eases
  toward an angle at a given speed, advanced every `loop()` via `update()` so
  moves never block. A servo's rest/"zero" angle can be overridden at
  runtime with `setRestAngle()`, persisted to flash (NVS) so it survives
  reboot without recompiling `Config.h`; `resetRestAngle()` clears the
  override. `goToRest()` and status reporting always use the current
  effective rest angle (override if set, else the compiled-in default).

- **AudioPlayer** - wraps `ESP8266Audio`'s I2S output for the MAX98357A.
  Plays `.mp3`/`.wav` files from LittleFS by path. A custom
  `AudioOutputI2S` subclass (`JawSyncOutput`) taps the raw PCM samples as
  they're written to the amp and runs an asymmetric envelope follower (fast
  attack, slow release) over them, exposed as `jawLevel()` (0.0-1.0).
  `main.cpp` maps that straight onto the jaw servo every loop while audio is
  playing - the mouth flaps in sync with whatever's actually playing, with no
  pre-baked timing/viseme data needed.

- **ControlAPI** - owns WiFi (station mode, falling back to a SoftAP if it
  can't connect) and an `ESPAsyncWebServer` exposing REST endpoints and a
  `/ws` WebSocket. This is the integration point for the planned app/web UI;
  see `docs/API.md` for the wire format. It only knows about JSON commands
  and callbacks - `main.cpp` wires those callbacks to `ServoController` and
  `AudioPlayer` so ControlAPI has no direct dependency on either.

- **GamepadController** - scaffold for BluePad32 8BitDo Ultimate support.
  Compiles to nothing unless built with `-DENABLE_BLUEPAD32` (the
  `esp32_bluepad32` PlatformIO environment), because it depends on the
  BluePad32 Arduino core, which replaces the standard Arduino-ESP32
  framework package. See `docs/BLUEPAD32.md` before touching this.

## Data flow: a spoken line

1. App/web UI sends `{"cmd":"play","file":"hello.mp3"}` over the WebSocket
   (or `POST /api/play`).
2. `ControlAPI` calls the play handler registered in `main.cpp`, which calls
   `AudioPlayer::play()`.
3. `AudioPlayer` starts decoding the file and streaming PCM to the
   MAX98357A over I2S.
4. Every `loop()`, `main.cpp` reads `AudioPlayer::jawLevel()` and pushes it
   onto the `jaw` servo via `ServoController::setAngle()`.
5. `ControlAPI::loop()` broadcasts a status frame (playing state, file, jaw
   level, all servo angles) to connected WebSocket clients a few times a
   second, so a UI can show a live "talking" indicator without polling.

## Where the app/web control layer fits in (roadmap)

The control API is deliberately app-agnostic: it's plain JSON over WebSocket
and REST, so the React Native app (`app/`), a browser page, or `curl` can all
drive it identically. Three speech pipelines are worth planning for:

1. **Pre-baked clips (supported today)**: app/cloud generates or picks a
   speech `.mp3`/`.wav`, gets it onto the device (e.g. an HTTP upload
   endpoint - not yet implemented, see `docs/API.md`'s TODO) into
   `data/audio/` or uploaded to LittleFS at runtime, then triggers it with
   `play`.
2. **Phone-side TTS (supported today, in `app/`)**: the app speaks typed
   text with the phone's own on-device TTS engine and, over the same control
   API, puppets the jaw servo in time with it. The audio comes from the
   phone's speaker, not the skull's amp - see `app/README.md`.
3. **Live streaming TTS to the skull (future)**: would need a streaming I2S
   write path instead of `AudioGenerator::begin()`/`loop()` against a file
   source - noted as a roadmap item rather than built now, since it's a
   materially different audio pipeline. Once it exists, the app's TTS
   pipeline is the natural thing to route through it instead of (2).

## Where BluePad32 fits in (roadmap)

`GamepadController` maps the right stick to neck pan/tilt, the left stick
(while holding L1) to direct jaw puppeteering, and face buttons to preset
speech clips, as a starting point - not a finished control scheme. See
`docs/BLUEPAD32.md` for what's required to actually build it.
