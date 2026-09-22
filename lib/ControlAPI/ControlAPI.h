#pragma once

#include <Arduino.h>
#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include <functional>
#include "Config.h"

// WiFi + JSON control surface for Skelly. This is the integration point for
// the future React Native app / web page: everything it can do is exposed
// both as REST endpoints and as WebSocket JSON commands on /ws. See
// docs/API.md for the wire format.
class ControlAPI {
public:
  using ServoCommandHandler = std::function<bool(const String &name, float angleDeg)>;
  using ServoZeroSetHandler = std::function<bool(const String &name, float angleDeg)>;
  using ServoZeroResetHandler = std::function<bool(const String &name)>;
  using PlayCommandHandler = std::function<bool(const String &file)>;
  using StopCommandHandler = std::function<void()>;
  using StatusProvider = std::function<void(JsonObject &out)>;

  // Connects WiFi (falling back to a SoftAP if STA fails) and starts the
  // HTTP + WebSocket server. Call once from setup().
  void begin();

  // Broadcasts a status frame to all connected WebSocket clients at
  // STATUS_BROADCAST_INTERVAL_MS. Call every loop() iteration.
  void loop();

  void onServoCommand(ServoCommandHandler handler) { servoHandler = handler; }
  // Persists a servo's rest/"zero" angle (survives reboot) without moving it.
  void onServoZeroSet(ServoZeroSetHandler handler) { servoZeroSetHandler = handler; }
  // Clears a persisted zero override, reverting to the compiled-in default.
  void onServoZeroReset(ServoZeroResetHandler handler) { servoZeroResetHandler = handler; }
  void onPlayCommand(PlayCommandHandler handler) { playHandler = handler; }
  void onStopCommand(StopCommandHandler handler) { stopHandler = handler; }
  // Lets main.cpp fill in the "status" JSON object (playing state, jaw
  // level, servo angles, ...) without ControlAPI needing to know about every
  // other module.
  void onStatusRequest(StatusProvider provider) { statusProvider = provider; }

private:
  AsyncWebServer server{CONTROL_API_PORT};
  AsyncWebSocket ws{"/ws"};
  uint32_t lastBroadcastMs = 0;

  ServoCommandHandler servoHandler;
  ServoZeroSetHandler servoZeroSetHandler;
  ServoZeroResetHandler servoZeroResetHandler;
  PlayCommandHandler playHandler;
  StopCommandHandler stopHandler;
  StatusProvider statusProvider;

  // State for the in-flight /api/upload request. ESPAsyncWebServer calls the
  // upload callback repeatedly for one request at a time, so a single set of
  // fields here is enough (no concurrent uploads expected on this device).
  File uploadFile;
  String uploadPath;
  bool uploadFailed = false;

  void connectWifi();
  void setupRoutes();
  void handleWsEvent(AsyncWebSocket *server, AsyncWebSocketClient *client,
                      AwsEventType type, void *arg, uint8_t *data, size_t len);
  void handleCommand(const JsonObject &cmd, JsonDocument &replyDoc);
  void buildStatus(JsonObject &out);
  void handleUpload(AsyncWebServerRequest *request, String filename, size_t index,
                     uint8_t *data, size_t len, bool final);
};
