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
import { SkellyClient, SkellyStatus, ConnectionState } from '../api/skellyClient';

const HOST_STORAGE_KEY = 'skelly:host';
const DEFAULT_HOST = '192.168.4.1'; // Skelly's own fallback AP, see include/Secrets.h.example

interface SkellyContextValue {
  host: string;
  setHost: (host: string) => void;
  connectionState: ConnectionState;
  connectionError?: string;
  status: SkellyStatus;
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
  });

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
    });

    client.connectWs();
    AsyncStorage.setItem(HOST_STORAGE_KEY, host).catch(() => {});

    return () => {
      offStatus();
      offConn();
      client.disconnectWs();
    };
  }, [host]);

  const setHost = useCallback((next: string) => {
    setHostState(next);
  }, []);

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
      client: clientRef.current,
      reconnect,
    }),
    [host, setHost, connectionState, connectionError, status, reconnect],
  );

  return <SkellyContext.Provider value={value}>{children}</SkellyContext.Provider>;
}

export function useSkelly(): SkellyContextValue {
  const ctx = useContext(SkellyContext);
  if (!ctx) throw new Error('useSkelly must be used within a SkellyProvider');
  return ctx;
}
