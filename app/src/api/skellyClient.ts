// Thin client for Skelly's WiFi JSON control API (see docs/API.md in the
// firmware repo). REST for one-off calls, WebSocket for live status and
// low-latency commands.

export type ServoName = 'jaw' | 'neck_pan' | 'neck_tilt' | 'eye_pan' | 'eye_tilt';

export interface SkellyStatus {
  playing: boolean;
  file: string | null;
  jawLevel: number;
  servos: Partial<Record<ServoName, number>>;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

type StatusListener = (status: SkellyStatus) => void;
type ConnectionListener = (state: ConnectionState, error?: string) => void;

const DEFAULT_STATUS: SkellyStatus = {
  playing: false,
  file: null,
  jawLevel: 0,
  servos: {},
};

function normalizeHost(host: string): string {
  const trimmed = host.trim().replace(/\/+$/, '');
  return trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed
    : `http://${trimmed}`;
}

export class SkellyClient {
  private baseUrl: string;
  private ws: WebSocket | null = null;
  private statusListeners = new Set<StatusListener>();
  private connectionListeners = new Set<ConnectionListener>();
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
            servos: msg.servos ?? {},
          });
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
      servos: body.servos ?? {},
    };
  }

  async getFiles(): Promise<string[]> {
    const body = await this.request('/api/files');
    return body.files ?? [];
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

  async setServo(name: ServoName, angle: number): Promise<boolean> {
    if (this.send({ cmd: 'servo', name, angle })) return true;
    const body = await this.request('/api/servo', {
      method: 'POST',
      body: JSON.stringify({ name, angle }),
    });
    return !!body.ok;
  }
}
