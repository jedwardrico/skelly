import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SERVO_LIST } from '../api/servoConfig';
import type { ServoName } from '../api/skellyClient';

const STORAGE_KEY = 'skelly:servoZero';

type ZeroOverrides = Partial<Record<ServoName, number>>;

const DEFAULT_ZERO: Record<ServoName, number> = Object.fromEntries(
  SERVO_LIST.map((s) => [s.name, s.rest]),
) as Record<ServoName, number>;

interface ServoCalibrationContextValue {
  // The servo's configured "0"/home angle - the firmware's compiled-in
  // restAngle until overridden here, then whatever was calibrated.
  getZero: (name: ServoName) => number;
  setZero: (name: ServoName, angleDeg: number) => void;
  resetZero: (name: ServoName) => void;
  isOverridden: (name: ServoName) => boolean;
  loaded: boolean;
}

const ServoCalibrationContext = createContext<ServoCalibrationContextValue | null>(null);

export function ServoCalibrationProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<ZeroOverrides>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setOverrides(JSON.parse(raw));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const persist = (next: ZeroOverrides) => {
    setOverrides(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const value = useMemo<ServoCalibrationContextValue>(
    () => ({
      getZero: (name) => overrides[name] ?? DEFAULT_ZERO[name],
      setZero: (name, angleDeg) => persist({ ...overrides, [name]: angleDeg }),
      resetZero: (name) => {
        const next = { ...overrides };
        delete next[name];
        persist(next);
      },
      isOverridden: (name) => overrides[name] !== undefined,
      loaded,
    }),
    [overrides, loaded],
  );

  return <ServoCalibrationContext.Provider value={value}>{children}</ServoCalibrationContext.Provider>;
}

export function useServoCalibration(): ServoCalibrationContextValue {
  const ctx = useContext(ServoCalibrationContext);
  if (!ctx) throw new Error('useServoCalibration must be used within a ServoCalibrationProvider');
  return ctx;
}
