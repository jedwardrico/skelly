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

// Strips any directory components and rejects anything that isn't a plain
// .mp3/.wav filename made of safe characters, so an upload can't escape
// AUDIO_DIR or clobber an arbitrary LittleFS path.
static String sanitizeAudioFilename(const String &raw) {
  String name = raw;
  int slash = name.lastIndexOf('/');
  if (slash >= 0) name = name.substring(slash + 1);
  name.trim();
  if (name.length() == 0) return String();

  String lower = name;
  lower.toLowerCase();
  if (!lower.endsWith(".mp3") && !lower.endsWith(".wav")) return String();

  for (size_t i = 0; i < name.length(); i++) {
    char c = name[i];
    bool ok = isalnum((unsigned char)c) || c == '.' || c == '-' || c == '_';
    if (!ok) return String();
  }
  return name;
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

  AsyncCallbackJsonWebHandler *servoZeroSet_ = new AsyncCallbackJsonWebHandler(
      "/api/servo/zero", [this](AsyncWebServerRequest *request, JsonVariant &json) {
        JsonObject obj = json.as<JsonObject>();
        String name = obj["name"] | "";
        float angle = obj["angle"] | NAN;
        bool ok = name.length() && !isnan(angle) && servoZeroSetHandler && servoZeroSetHandler(name, angle);
        request->send(ok ? 200 : 400, "application/json",
                      ok ? "{\"ok\":true}" : "{\"ok\":false,\"error\":\"set zero failed\"}");
      });
  server.addHandler(servoZeroSet_);

  AsyncCallbackJsonWebHandler *servoZeroReset_ = new AsyncCallbackJsonWebHandler(
      "/api/servo/zero/reset", [this](AsyncWebServerRequest *request, JsonVariant &json) {
        JsonObject obj = json.as<JsonObject>();
        String name = obj["name"] | "";
        bool ok = name.length() && servoZeroResetHandler && servoZeroResetHandler(name);
        request->send(ok ? 200 : 400, "application/json",
                      ok ? "{\"ok\":true}" : "{\"ok\":false,\"error\":\"reset zero failed\"}");
      });
  server.addHandler(servoZeroReset_);

  server.on(
      "/api/upload", HTTP_POST,
      [this](AsyncWebServerRequest *request) {
        bool ok = !uploadFailed && uploadPath.length() > 0;
        if (ok) {
          JsonDocument doc;
          doc["ok"] = true;
          doc["file"] = uploadPath;
          String body;
          serializeJson(doc, body);
          request->send(200, "application/json", body);
        } else {
          request->send(400, "application/json",
                         "{\"ok\":false,\"error\":\"upload failed\"}");
        }
      },
      [this](AsyncWebServerRequest *request, String filename, size_t index, uint8_t *data,
             size_t len, bool final) {
        handleUpload(request, filename, index, data, len, final);
      });

  server.onNotFound([](AsyncWebServerRequest *request) {
    request->send(404, "application/json", "{\"ok\":false,\"error\":\"not found\"}");
  });
}

void ControlAPI::handleUpload(AsyncWebServerRequest *request, String filename, size_t index,
                               uint8_t *data, size_t len, bool final) {
  if (index == 0) {
    uploadFailed = false;
    uploadPath = "";
    String safeName = sanitizeAudioFilename(filename);
    if (safeName.isEmpty()) {
      Serial.printf("[ControlAPI] upload rejected, bad filename \"%s\"\n", filename.c_str());
      uploadFailed = true;
      return;
    }
    if (uploadFile) uploadFile.close();
    String path = String(AUDIO_DIR) + "/" + safeName;
    uploadFile = LittleFS.open(path, "w");
    if (!uploadFile) {
      Serial.printf("[ControlAPI] upload failed to open \"%s\"\n", path.c_str());
      uploadFailed = true;
      return;
    }
    uploadPath = path;
    Serial.printf("[ControlAPI] upload starting -> %s\n", path.c_str());
  }

  if (uploadFailed || !uploadFile) return;

  if (len && uploadFile.write(data, len) != len) {
    Serial.println("[ControlAPI] upload write failed");
    uploadFailed = true;
    uploadFile.close();
    return;
  }

  if (final) {
    uploadFile.close();
    Serial.printf("[ControlAPI] upload complete -> %s (%u bytes)\n", uploadPath.c_str(),
                   (unsigned)(index + len));
  }
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
  } else if (type == "setZero") {
    String name = cmd["name"] | "";
    float angle = cmd["angle"] | NAN;
    bool ok = name.length() && !isnan(angle) && servoZeroSetHandler && servoZeroSetHandler(name, angle);
    reply["type"] = "ack";
    reply["cmd"] = "setZero";
    reply["ok"] = ok;
  } else if (type == "resetZero") {
    String name = cmd["name"] | "";
    bool ok = name.length() && servoZeroResetHandler && servoZeroResetHandler(name);
    reply["type"] = "ack";
    reply["cmd"] = "resetZero";
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
