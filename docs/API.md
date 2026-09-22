# Control API

Used by the React Native app (`app/`). Plain JSON, no auth (the ESP32 is
assumed to be on a trusted local network - see "Security" below before
exposing it any further).

Base URL: `http://<skelly-ip>/` (falls back to `http://192.168.4.1/` when
Skelly is hosting its own `Skelly-Setup` AP because it couldn't join your
WiFi - see `include/Secrets.h.example`).

## REST

### `GET /api/status`
```json
{
  "playing": true,
  "file": "/audio/hello.mp3",
  "jawLevel": 0.42,
  "servos": { "jaw": 23.1, "neck_pan": 90, "neck_tilt": 90, "eye_pan": 90, "eye_tilt": 90 },
  "servoZero": { "jaw": 0, "neck_pan": 90, "neck_tilt": 90, "eye_pan": 90, "eye_tilt": 90 }
}
```

### `GET /api/files`
Lists what's available to play from `data/audio/` (uploaded via
`pio run --target uploadfs`, see main README).
```json
{ "files": ["/audio/hello.mp3", "/audio/laugh.mp3"] }
```

### `POST /api/play`
```json
{ "file": "hello.mp3" }
```
Accepts either a bare filename (resolved under `AUDIO_DIR`, `/audio` by
default) or a full LittleFS path. Response: `{"ok":true}` or
`{"ok":false,"error":"..."}`.

### `POST /api/stop`
No body. Stops playback immediately (jaw returns to idle on the next loop).

### `POST /api/servo`
```json
{ "name": "neck_pan", "angle": 45 }
```
`name` must match an entry in `SERVO_CHANNELS` (`include/Config.h`). Moves
instantly; angle is clamped to that servo's configured min/max.

### `POST /api/servo/zero`
```json
{ "name": "jaw", "angle": 4 }
```
Persists `angle` as that servo's rest/"zero" position to flash (NVS) -
survives reboot without recompiling `Config.h`. Clamped to the servo's
configured min/max. Does **not** move the servo; follow with `/api/servo` if
you want it to jump there too. Response: `{"ok":true}` or
`{"ok":false,"error":"..."}`.

### `POST /api/upload`
`multipart/form-data` with a single file field. The uploaded filename (path
components stripped) is sanitized to safe characters and must end in `.mp3`
or `.wav`; it's written straight into `AUDIO_DIR` (`/audio`) on LittleFS,
overwriting any existing file of the same name. Not chunked/resumable - if
the connection drops mid-upload the partial file is left in place, so a
failed upload should be retried with the same name. Response:
`{"ok":true,"file":"/audio/hello.mp3"}` or `{"ok":false,"error":"..."}`.

```bash
curl -F "file=@hello.mp3" http://<skelly-ip>/api/upload
```

Play it afterwards the same way as a clip pushed via `uploadfs`: `POST
/api/play` with that filename.

### `POST /api/servo/zero/reset`
```json
{ "name": "jaw" }
```
Clears a persisted override, reverting to the compiled-in `restAngle` from
`Config.h`. Response: `{"ok":true}` or `{"ok":false,"error":"..."}`.

## WebSocket (`/ws`)

Same command set as REST, sent as JSON text frames, plus unsolicited status
broadcasts (~20Hz while at least one client is connected) so a UI can
animate a "talking" indicator or mouth graphic without polling:

```json
// client -> server
{ "cmd": "play", "file": "hello.mp3" }
{ "cmd": "stop" }
{ "cmd": "servo", "name": "jaw", "angle": 30 }
{ "cmd": "setZero", "name": "jaw", "angle": 4 }
{ "cmd": "resetZero", "name": "jaw" }
{ "cmd": "status" }

// server -> client (ack for any of the above)
{ "type": "ack", "cmd": "play", "ok": true }

// server -> client (periodic broadcast, or reply to {"cmd":"status"})
{
  "type": "status",
  "playing": true,
  "file": "/audio/hello.mp3",
  "jawLevel": 0.42,
  "servos": { "jaw": 23.1, "neck_pan": 90, ... },
  "servoZero": { "jaw": 4, "neck_pan": 90, ... }
}
```

`servoZero` in the status payload is each servo's current effective rest
angle (persisted override if one was set via `/api/servo/zero`, otherwise
the compiled-in default from `Config.h`) - read it to show the app's
calibration UI the skull's actual state after a reboot or a fresh connect.

## Not yet implemented (roadmap for the app work)

- **Streaming playback** - for live TTS rather than pre-baked clips; see
  `docs/ARCHITECTURE.md`.
- **Auth** - none today. Fine on a private home network; add at least a
  shared-secret header/query param before exposing this beyond your LAN.
