# Skelly app

React Native (Expo) app for controlling the Skelly animatronic skull over
WiFi, plus on-device text-to-speech.

## What it does

- **Connect** - point the app at the skull's IP (shown on the ESP32's serial
  monitor at boot, or `192.168.4.1` if it's hosting its own `Skelly-Setup`
  fallback AP). Connection state and live status stream over the `/ws`
  WebSocket, REST is used as a fallback (see `../docs/API.md`).
- **Control** - see what's playing and the live jaw level, play/stop the
  speech clips already on the skull's LittleFS (`data/audio/`), and jog the
  jaw/neck/eye servos with sliders.
- **Speech** - type text and speak it with the phone's own text-to-speech
  engine (`expo-speech`), with rate/pitch/voice controls. Optionally
  puppeteers the skull's jaw servo in time with the phone's speech via the
  control API.
- **Setup** - per-servo zero/rest calibration: jog a servo to where it should
  sit at rest and save it as that servo's "zero" (persisted on the skull
  itself via `POST /api/servo/zero`, survives reboot), or reset back to the
  firmware's compiled-in default. Used by "Home all" here and by the jaw
  puppeteering in the Speech tab.

## Why TTS plays through the phone, not the skull

The firmware only plays pre-baked `.mp3`/`.wav` files today - there's no
endpoint yet for streaming freshly-generated audio to the skull's MAX98357A
amp, and no upload endpoint for pushing new clips over WiFi (both are
tracked in `../docs/API.md` and `../docs/ARCHITECTURE.md`'s roadmap
sections). Until then, this is the practical way to get "type text, hear it
out loud with a moving jaw": the phone does the talking, the skull just
puppets along.

Once an upload/streaming endpoint exists, the natural upgrade is: synthesize
audio (on-device or via a cloud TTS API), push it to the skull, and let the
existing audio-envelope jaw sync (`lib/AudioPlayer/JawSyncOutput`) drive the
jaw from the real waveform instead of word-boundary pulses.

## Project layout

```
App.tsx                    tab shell (Connect / Control / Speech / Setup)
src/api/skellyClient.ts    REST + WebSocket client for the control API
src/api/servoConfig.ts     servo names/ranges, mirrors include/Config.h
src/context/SkellyContext  shared connection + live status state (incl. servoZero)
src/screens/                one component per tab
src/components/             small shared UI bits (connection badge, slider)
```

### Servo zero calibration

`ServoController::setRestAngle()` (`lib/ServoController/`) persists a
per-servo rest override to the ESP32's flash (NVS), read back on boot - see
`POST /api/servo/zero` and `POST /api/servo/zero/reset` in `../docs/API.md`.
The Setup tab is a thin UI over that: it reads `servoZero` from live device
status and calls those endpoints, so calibration lives on the skull, not the
phone - any phone/app connecting sees the same zero, and it survives a
reboot. "Home all" and the jaw's rest position between puppeted words in the
Speech tab both use it.

## Getting started

```
npm install
npm run start   # then press a/i/w, or scan the QR code with Expo Go
```

No native build step needed for development - it's an Expo managed app, so
Expo Go (iOS/Android) or a simulator is enough to run it. `npm run web` also
works but needs `react-dom`/`react-native-web` (`npx expo install react-dom
react-native-web`) since those aren't installed by default.

The skull's IP is persisted locally (`AsyncStorage`) so you don't have to
retype it every launch.
