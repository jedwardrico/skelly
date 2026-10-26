# Skelly app

React Native (Expo) app for controlling the Skelly animatronic skull over
WiFi, plus on-device text-to-speech.

## What it does

- **Connect** - point the app at the skull's IP (shown on the ESP32's serial
  monitor at boot, or `192.168.1.113` if it's hosting its own `Skelly-Setup`
  fallback AP). Connection state and live status stream over the `/ws`
  WebSocket, REST is used as a fallback (see `../docs/API.md`).
- **Control** - see what's playing and the live jaw level (with a Stop
  button), and jog the jaw/eye servos with sliders.
- **Speech** - type text and have Skelly say it. By default the text is
  turned into speech with ElevenLabs (`eleven_v4`, searchable voice picker
  that defaults to Gork), uploaded to the skull and played on its speaker with
  the jaw following the audio; or, if you switch it off in Setup, the phone's
  own text-to-speech engine (`expo-speech`) is used and puppets the jaw servo
  in time with the phone's speech via the control API. Rate, voice and (phone
  only) pitch controls. The tab also holds the skull's stored speech clips:
  play them, refresh the list, or upload a recorded `.mp3`/`.wav` straight
  to the skull over WiFi (`POST /api/upload`, no USB/`uploadfs` needed).
- **Logs** - live view of the skull's serial output (what `pio device monitor`
  shows), streamed over the WebSocket; handy for debugging uploads and WiFi
  without a USB cable.
- **Setup** - the "play through skull speaker" switch, the ElevenLabs API
  key (saved on the phone), a no-credit audio test (uploads and plays a
  generated tone and verifies the transfer), and per-servo
  zero/rest calibration: jog a servo to where it should
  sit at rest and save it as that servo's "zero" (persisted on the skull
  itself via `POST /api/servo/zero`, survives reboot), or reset back to the
  firmware's compiled-in default. Used by "Home all" here and by the jaw
  puppeteering in the Speech tab. Also has the dark mode toggle - the app
  defaults to dark, and the choice is remembered locally (`AsyncStorage`).

## Speech: skull speaker vs. phone speaker

The Speech tab's "Play through skull speaker" switch (on by default) sends
the typed text to ElevenLabs' TTS API (`eleven_v4`, key entered in the
Setup tab and stored locally in `AsyncStorage`), uploads the returned mp3 to the
skull as `speech.mp3` (`POST /api/upload`), and triggers `play`. The audio
comes out of the MAX98357A amp and the existing audio-envelope jaw sync
(`lib/AudioPlayer/JawSyncOutput`) drives the jaw from the real waveform.
The phone needs internet for the TTS call as well as a route to the skull.

With the switch off, the app falls back to `expo-speech` on the phone's own
speaker, since on-device TTS can't be captured as a file to upload; the jaw
is puppeted with word-boundary pulses instead. True streaming (starting
playback before the clip is fully generated) is still a roadmap item - see
`../docs/ARCHITECTURE.md`.

## Project layout

```
App.tsx                    tab shell (Connect / Control / Speech / Setup / Logs)
src/api/skellyClient.ts    REST + WebSocket client for the control API
src/api/servoConfig.ts     servo names/ranges, mirrors include/Config.h
src/context/SkellyContext  shared connection + live status state (incl. servoZero)
src/theme/                  dark/light color palettes + theme context (dark by default)
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

## EAS

The app is wired for [EAS Update](https://docs.expo.dev/eas-update/introduction/)
(`eas.json`, `expo-updates`, `runtimeVersion.policy: sdkVersion`, and
`extra.eas.projectId`/`updates.url` in `app.json`) so JS/asset changes can
ship over the air without an app-store resubmission, same as
`lift-tracker`'s setup. The app is already linked to its EAS project; if you
need to re-link it (e.g. a fresh Expo account) run `npx eas-cli login` then
`npx eas-cli init` from `app/`.

- `npm run update:qa` publishes the current JS bundle to the `production`
  update branch by hand.
- [`../.github/workflows/eas-update.yml`](../.github/workflows/eas-update.yml)
  does the same automatically on every push to `main` that touches `app/`:
  it bumps the patch version in `app.json` (`scripts/bump-app-version.js`),
  commits that, then runs `eas update`. It needs an `EXPO_TOKEN` repo secret
  (an [Expo access token](https://docs.expo.dev/accounts/programmatic-access/))
  with publish access to the project.

`eas build` (producing installable dev/production binaries instead of OTA
updates) isn't set up yet - `eas.json` only pins the CLI version, with no
`build` profiles, matching `lift-tracker` today.
