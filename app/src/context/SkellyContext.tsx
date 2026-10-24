import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SkellyClient, SkellyStatus, ConnectionState, LogLine } from '../api/skellyClient';

const HOST_STORAGE_KEY = 'skelly:host';
const MAX_LOG_LINES = 500;
const DEFAULT_HOST = '192.168.1.113'; // Skelly on the home network (fallback AP 192.168.1.113)

interface SkellyContextValue {
  host: string;
  setHost: (host: string) => void;
  connectionState: ConnectionState;
  connectionError?: string;
  status: SkellyStatus;
  logs: LogLine[];
  clearLogs: () => void;
  client: SkellyClient;
  reconnect: () => void;
}

const SkellyContext = createContext<SkellyContextValue | null>(null);

export function SkellyProvider({ children }: { children: React.ReactNode }) {
  const [host, setHostState] = useState(DEFAULT_HOST);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [connectionError, setConnectionError] = useState<string>();
  const [status, setStatus] = useState<SkellyStatus>({
    playing: false,
    file: null,
    jawLevel: 0,
    servos: {},
    servoZero: {},
  });

  const [logs, setLogs] = useState<LogLine[]>([]);

  const clientRef = useRef<SkellyClient>(new SkellyClient(DEFAULT_HOST));

  useEffect(() => {
    AsyncStorage.getItem(HOST_STORAGE_KEY).then((saved) => {
      if (saved) setHostState(saved);
    });
  }, []);

  useEffect(() => {
    clientRef.current.disconnectWs();
    const client = new SkellyClient(host);
    clientRef.current = client;

    const offStatus = client.onStatus(setStatus);
    const offConn = client.onConnectionChange((state, error) => {
      setConnectionState(state);
      setConnectionError(error);
      if (state === 'connected') {
        // Fresh connection (possibly after a reboot, which restarts the
        // device's line counter): reload the backlog, keeping any live
        // lines newer than it that arrived while the request was in flight.
        setLogs([]);
        client
          .getLogs()
          .then(({ latest, lines }) =>
            setLogs((prev) => [...lines, ...prev.filter((l) => l.seq > latest)].slice(-MAX_LOG_LINES)),
          )
          .catch(() => {});
      }
    });
    const offLog = client.onLog((line) =>
      setLogs((prev) => {
        const last = prev[prev.length - 1];
        if (last && line.seq <= last.seq) return prev;
        return [...prev, line].slice(-MAX_LOG_LINES);
      }),
    );

    client.connectWs();
    AsyncStorage.setItem(HOST_STORAGE_KEY, host).catch(() => {});

    return () => {
      offStatus();
      offConn();
      offLog();
      client.disconnectWs();
    };
  }, [host]);

  const setHost = useCallback((next: string) => {
    setHostState(next);
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  const reconnect = useCallback(() => {
    clientRef.current.disconnectWs();
    clientRef.current.connectWs();
  }, []);

  const value = useMemo(
    () => ({
      host,
      setHost,
      connectionState,
      connectionError,
      status,
      logs,
      clearLogs,
      client: clientRef.current,
      reconnect,
    }),
    [host, setHost, connectionState, connectionError, status, logs, clearLogs, reconnect],
  );

  return <SkellyContext.Provider value={value}>{children}</SkellyContext.Provider>;
}

export function useSkelly(): SkellyContextValue {
  const ctx = useContext(SkellyContext);
  if (!ctx) throw new Error('useSkelly must be used within a SkellyProvider');
  return ctx;
}
