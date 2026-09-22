# Control API

Used by the (future) React Native app / web page. Plain JSON, no auth (the
ESP32 is assumed to be on a trusted local network - see "Security" below
before exposing it any further).

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
  "servos": { "jaw": 23.1, "neck_pan": 90, "neck_tilt": 90, "eye_pan": 90, "eye_tilt": 90 }
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

## WebSocket (`/ws`)

Same command set as REST, sent as JSON text frames, plus unsolicited status
broadcasts (~20Hz while at least one client is connected) so a UI can
animate a "talking" indicator or mouth graphic without polling:

```json
// client -> server
{ "cmd": "play", "file": "hello.mp3" }
{ "cmd": "stop" }
{ "cmd": "servo", "name": "jaw", "angle": 30 }
{ "cmd": "status" }

// server -> client (ack for any of the above)
{ "type": "ack", "cmd": "play", "ok": true }

// server -> client (periodic broadcast, or reply to {"cmd":"status"})
{ "type": "status", "playing": true, "file": "/audio/hello.mp3", "jawLevel": 0.42, "servos": {...} }
```

## Not yet implemented (roadmap for the app work)

- **File upload endpoint** - today, new audio clips have to be pushed via
  `pio run --target uploadfs` over USB. A `POST /api/upload` (multipart or
  chunked) that writes straight into LittleFS is the natural next step once
  the app needs to push freshly-generated TTS to the skull over WiFi.
- **Streaming playback** - for live TTS rather than pre-baked clips; see
  `docs/ARCHITECTURE.md`.
- **Auth** - none today. Fine on a private home network; add at least a
  shared-secret header/query param before exposing this beyond your LAN.
