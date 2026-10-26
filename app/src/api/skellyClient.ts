// Thin client for Skelly's WiFi JSON control API (see docs/API.md in the
// firmware repo). REST for one-off calls, WebSocket for live status and
// low-latency commands.

export type ServoName = 'jaw' | 'eye_pan' | 'eye_tilt';

export interface SkellyStatus {
  playing: boolean;
  file: string | null;
  jawLevel: number;
  // Output volume, 0.0-1.0.
  volume: number;
  servos: Partial<Record<ServoName, number>>;
  // Each servo's current effective rest/"zero" angle, as persisted on the
  // device (survives reboot) - see POST /api/servo/zero in docs/API.md.
  servoZero: Partial<Record<ServoName, number>>;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// One line of the firmware's serial output (see lib/SkellyLog and GET
// /api/logs). `seq` is a per-boot counter used to de-dupe the REST backlog
// against lines that also arrived live over the WebSocket.
export interface LogLine {
  seq: number;
  text: string;
}

type StatusListener = (status: SkellyStatus) => void;
type LogListener = (line: LogLine) => void;
type ConnectionListener = (state: ConnectionState, error?: string) => void;

const DEFAULT_STATUS: SkellyStatus = {
  playing: false,
  file: null,
  jawLevel: 0,
  volume: 0.6,
  servos: {},
  servoZero: {},
};

function normalizeHost(host: string): string {
  const trimmed = host.trim().replace(/\/+$/, '');
  return trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed
    : `http://${trimmed}`;
}

// Reads a local file:// (or content://) URI into a Blob. XMLHttpRequest is used
// because it can load local URIs and hand back a Blob on React Native.
function readFileAsBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error('Could not read the selected file'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri);
    xhr.send();
  });
}

export class SkellyClient {
  private baseUrl: string;
  private ws: WebSocket | null = null;
  private statusListeners = new Set<StatusListener>();
  private connectionListeners = new Set<ConnectionListener>();
  private logListeners = new Set<LogListener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUser = false;
  private lastStatus: SkellyStatus = DEFAULT_STATUS;

  constructor(host: string) {
    this.baseUrl = normalizeHost(host);
  }

  get url(): string {
    return this.baseUrl;
  }

  get status(): SkellyStatus {
    return this.lastStatus;
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onConnectionChange(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  onLog(listener: LogListener): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  private emitStatus(status: SkellyStatus) {
    this.lastStatus = status;
    this.statusListeners.forEach((l) => l(status));
  }

  private emitConnection(state: ConnectionState, error?: string) {
    this.connectionListeners.forEach((l) => l(state, error));
  }

  connectWs() {
    this.closedByUser = false;
    this.openSocket();
  }

  private openSocket() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/ws';
    this.emitConnection('connecting');

    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl);
    } catch (err) {
      this.emitConnection('error', String(err));
      this.scheduleReconnect();
      return;
    }

    this.ws = socket;

    socket.onopen = () => {
      this.emitConnection('connected');
      this.send({ cmd: 'status' });
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'status') {
          this.emitStatus({
            playing: !!msg.playing,
            file: msg.file ?? null,
            jawLevel: typeof msg.jawLevel === 'number' ? msg.jawLevel : 0,
            volume: typeof msg.volume === 'number' ? msg.volume : DEFAULT_STATUS.volume,
            servos: msg.servos ?? {},
            servoZero: msg.servoZero ?? {},
          });
        } else if (msg.type === 'log' && typeof msg.seq === 'number' && typeof msg.text === 'string') {
          const line = { seq: msg.seq, text: msg.text };
          this.logListeners.forEach((l) => l(line));
        }
      } catch {
        // ignore malformed frames
      }
    };

    socket.onerror = () => {
      this.emitConnection('error', 'WebSocket error');
    };

    socket.onclose = () => {
      this.ws = null;
      if (!this.closedByUser) {
        this.emitConnection('disconnected');
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect() {
    if (this.closedByUser || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => this.openSocket(), 3000);
  }

  disconnectWs() {
    this.closedByUser = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  private send(cmd: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(cmd));
      return true;
    }
    return false;
  }

  private async request(path: string, init?: RequestInit) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error ?? `HTTP ${res.status}`);
    }
    return body;
  }

  async getStatus(): Promise<SkellyStatus> {
    const body = await this.request('/api/status');
    return {
      playing: !!body.playing,
      file: body.file ?? null,
      jawLevel: typeof body.jawLevel === 'number' ? body.jawLevel : 0,
      volume: typeof body.volume === 'number' ? body.volume : DEFAULT_STATUS.volume,
      servos: body.servos ?? {},
      servoZero: body.servoZero ?? {},
    };
  }

  // Recent serial output kept on the device (newest last).
  async getLogs(): Promise<{ latest: number; lines: LogLine[] }> {
    const body = await this.request('/api/logs');
    return { latest: body.latest ?? 0, lines: body.lines ?? [] };
  }

  async getFiles(): Promise<string[]> {
    const body = await this.request('/api/files');
    return body.files ?? [];
  }

  // Removes a stored clip. Rejects if it is currently playing (HTTP 409).
  async deleteFile(file: string): Promise<void> {
    const name = file.replace(/^\/?audio\//, '');
    await this.request(`/api/files?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
  }

  // Pushes a recorded clip to the skull's LittleFS over WiFi (see
  // POST /api/upload in docs/API.md) instead of `pio run --target uploadfs`
  // over USB. `name` must end in .mp3/.wav; the firmware sanitizes it and
  // writes it into AUDIO_DIR, overwriting any existing file of the same name.
  //
  // Expo's fetch rejects React Native's `{uri, name, type}` FormData parts
  // ("Unsupported FormDataPart implementation") and only takes real Blobs, so
  // the picked file is read into a Blob first.
  async uploadFile(uri: string, name: string, _mimeType?: string): Promise<string> {
    return this.uploadBlob(await readFileAsBlob(uri), name);
  }

  // Same endpoint as uploadFile, for audio already in memory (e.g. freshly
  // synthesized TTS) rather than a picked file on disk.
  async uploadBlob(blob: Blob, name: string): Promise<string> {
    return (await this.uploadBlobInfo(blob, name)).file;
  }

  // As uploadBlob, but also returns the size and CRC-32 the firmware computed
  // over the bytes it received, so callers can verify the transfer.
  async uploadBlobInfo(
    blob: Blob,
    name: string,
  ): Promise<{ file: string; size?: number; crc32?: number }> {
    const form = new FormData();
    form.append('file', blob, name);

    const res = await fetch(`${this.baseUrl}/api/upload`, {
      method: 'POST',
      body: form,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) {
      throw new Error(body?.error ?? `HTTP ${res.status}`);
    }
    return { file: body.file as string, size: body.size, crc32: body.crc32 };
  }

  // Prefers the WebSocket (instant, no extra round trip) and falls back to
  // REST if it isn't connected yet.
  async play(file: string): Promise<boolean> {
    if (this.send({ cmd: 'play', file })) return true;
    const body = await this.request('/api/play', { method: 'POST', body: JSON.stringify({ file }) });
    return !!body.ok;
  }

  async stop(): Promise<boolean> {
    if (this.send({ cmd: 'stop' })) return true;
    const body = await this.request('/api/stop', { method: 'POST' });
    return !!body.ok;
  }

  async setVolume(volume: number): Promise<boolean> {
    if (this.send({ cmd: 'volume', volume })) return true;
    const body = await this.request('/api/volume', { method: 'POST', body: JSON.stringify({ volume }) });
    return !!body.ok;
  }

  async setServo(name: ServoName, angle: number): Promise<boolean> {
    if (this.send({ cmd: 'servo', name, angle })) return true;
    const body = await this.request('/api/servo', {
      method: 'POST',
      body: JSON.stringify({ name, angle }),
    });
    return !!body.ok;
  }

  // Persists angle as the servo's rest/"zero" position on the device itself
  // (survives reboot). Does not move the servo.
  async setServoZero(name: ServoName, angle: number): Promise<boolean> {
    if (this.send({ cmd: 'setZero', name, angle })) return true;
    const body = await this.request('/api/servo/zero', {
      method: 'POST',
      body: JSON.stringify({ name, angle }),
    });
    return !!body.ok;
  }

  // Clears a persisted zero override, reverting to the firmware's
  // compiled-in default.
  async resetServoZero(name: ServoName): Promise<boolean> {
    if (this.send({ cmd: 'resetZero', name })) return true;
    const body = await this.request('/api/servo/zero/reset', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    return !!body.ok;
  }
}
