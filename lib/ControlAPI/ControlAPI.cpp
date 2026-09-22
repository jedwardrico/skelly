#include "ControlAPI.h"
#include <ArduinoJson.h>
#include <AsyncJson.h>
#include <LittleFS.h>

void ControlAPI::begin() {
  connectWifi();
  setupRoutes();

  ws.onEvent([this](AsyncWebSocket *s, AsyncWebSocketClient *c, AwsEventType type,
                     void *arg, uint8_t *data, size_t len) {
    handleWsEvent(s, c, type, arg, data, len);
  });
  server.addHandler(&ws);

  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin", "*");
  server.begin();

  Serial.println("[ControlAPI] server started on port " + String(CONTROL_API_PORT));
}

void ControlAPI::connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.printf("[ControlAPI] connecting to WiFi \"%s\"", WIFI_SSID);
  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_CONNECT_TIMEOUT_MS) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[ControlAPI] connected, IP = %s\n", WiFi.localIP().toString().c_str());
    return;
  }

  Serial.println("[ControlAPI] WiFi connect failed, starting fallback AP");
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_FALLBACK_SSID, AP_FALLBACK_PASSWORD);
  Serial.printf("[ControlAPI] AP \"%s\" up, IP = %s\n", AP_FALLBACK_SSID,
                WiFi.softAPIP().toString().c_str());
}

void ControlAPI::buildStatus(JsonObject &out) {
  if (statusProvider) statusProvider(out);
}

void ControlAPI::setupRoutes() {
  server.on("/api/status", HTTP_GET, [this](AsyncWebServerRequest *request) {
    JsonDocument doc;
    JsonObject obj = doc.to<JsonObject>();
    buildStatus(obj);
    String body;
    serializeJson(doc, body);
    request->send(200, "application/json", body);
  });

  server.on("/api/files", HTTP_GET, [](AsyncWebServerRequest *request) {
    JsonDocument doc;
    JsonArray files = doc["files"].to<JsonArray>();
    File dir = LittleFS.open(AUDIO_DIR);
    if (dir && dir.isDirectory()) {
      File entry = dir.openNextFile();
      while (entry) {
        files.add(String(entry.name()));
        entry = dir.openNextFile();
      }
    }
    String body;
    serializeJson(doc, body);
    request->send(200, "application/json", body);
  });

  server.on("/api/stop", HTTP_POST, [this](AsyncWebServerRequest *request) {
    if (stopHandler) stopHandler();
    request->send(200, "application/json", "{\"ok\":true}");
  });

  AsyncCallbackJsonWebHandler *playHandler_ = new AsyncCallbackJsonWebHandler(
      "/api/play", [this](AsyncWebServerRequest *request, JsonVariant &json) {
        JsonObject obj = json.as<JsonObject>();
        String file = obj["file"] | "";
        bool ok = file.length() && playHandler && playHandler(file);
        request->send(ok ? 200 : 400, "application/json",
                      ok ? "{\"ok\":true}" : "{\"ok\":false,\"error\":\"play failed\"}");
      });
  server.addHandler(playHandler_);

  AsyncCallbackJsonWebHandler *servoHandler_ = new AsyncCallbackJsonWebHandler(
      "/api/servo", [this](AsyncWebServerRequest *request, JsonVariant &json) {
        JsonObject obj = json.as<JsonObject>();
        String name = obj["name"] | "";
        float angle = obj["angle"] | NAN;
        bool ok = name.length() && !isnan(angle) && servoHandler && servoHandler(name, angle);
        request->send(ok ? 200 : 400, "application/json",
                      ok ? "{\"ok\":true}" : "{\"ok\":false,\"error\":\"servo command failed\"}");
      });
  server.addHandler(servoHandler_);

  server.onNotFound([](AsyncWebServerRequest *request) {
    request->send(404, "application/json", "{\"ok\":false,\"error\":\"not found\"}");
  });
}

void ControlAPI::handleCommand(const JsonObject &cmd, JsonDocument &replyDoc) {
  String type = cmd["cmd"] | "";
  JsonObject reply = replyDoc.to<JsonObject>();

  if (type == "play") {
    String file = cmd["file"] | "";
    bool ok = file.length() && playHandler && playHandler(file);
    reply["type"] = "ack";
    reply["cmd"] = "play";
    reply["ok"] = ok;
  } else if (type == "stop") {
    if (stopHandler) stopHandler();
    reply["type"] = "ack";
    reply["cmd"] = "stop";
    reply["ok"] = true;
  } else if (type == "servo") {
    String name = cmd["name"] | "";
    float angle = cmd["angle"] | NAN;
    float speed = cmd["speed"] | 0.0f;
    bool ok = name.length() && !isnan(angle) && servoHandler && servoHandler(name, angle);
    (void)speed; // eased moves go through /api/servo with speed once exposed on ServoController target API
    reply["type"] = "ack";
    reply["cmd"] = "servo";
    reply["ok"] = ok;
  } else if (type == "status") {
    reply["type"] = "status";
    buildStatus(reply);
  } else {
    reply["type"] = "error";
    reply["error"] = "unknown cmd";
  }
}

void ControlAPI::handleWsEvent(AsyncWebSocket *s, AsyncWebSocketClient *client,
                                AwsEventType type, void *arg, uint8_t *data, size_t len) {
  if (type == WS_EVT_CONNECT) {
    Serial.printf("[ControlAPI] ws client #%u connected\n", client->id());
  } else if (type == WS_EVT_DISCONNECT) {
    Serial.printf("[ControlAPI] ws client #%u disconnected\n", client->id());
  } else if (type == WS_EVT_DATA) {
    AwsFrameInfo *info = (AwsFrameInfo *)arg;
    if (!info->final || info->index != 0 || info->len != len || info->opcode != WS_TEXT) {
      return; // ignore fragmented/binary frames; commands are single-frame JSON text
    }
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, data, len);
    if (err) {
      client->text("{\"type\":\"error\",\"error\":\"bad json\"}");
      return;
    }
    JsonDocument replyDoc;
    handleCommand(doc.as<JsonObject>(), replyDoc);
    String reply;
    serializeJson(replyDoc, reply);
    client->text(reply);
  }
}

void ControlAPI::loop() {
  ws.cleanupClients();

  uint32_t now = millis();
  if (now - lastBroadcastMs < STATUS_BROADCAST_INTERVAL_MS) return;
  lastBroadcastMs = now;
  if (ws.count() == 0) return;

  JsonDocument doc;
  doc["type"] = "status";
  JsonObject obj = doc.as<JsonObject>();
  buildStatus(obj);
  String body;
  serializeJson(doc, body);
  ws.textAll(body);
}
