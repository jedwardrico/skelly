import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useSkelly } from '../context/SkellyContext';
import { useTheme } from '../theme/ThemeContext';
import { ANIMATION_GROUPS, type AnimParam, type AnimationValues } from '../api/animationConfig';

function formatValue(p: AnimParam, v: number): string {
  const decimals = p.step >= 1 ? 0 : p.step >= 0.1 ? 1 : p.step >= 0.01 ? 2 : 3;
  return `${v.toFixed(decimals)}${p.unit ? ` ${p.unit}` : ''}`;
}

function ParamRow({
  param,
  value,
  defaultValue,
  onCommit,
}: {
  param: AnimParam;
  value: number;
  defaultValue?: number;
  onCommit: (key: string, v: number) => void;
}) {
  const { colors } = useTheme();
  const [local, setLocal] = useState<number | null>(null);
  const shown = local ?? value;
  const changed = defaultValue != null && Math.abs(shown - defaultValue) > param.step / 2;

  return (
    <View style={styles.param}>
      <View style={styles.paramHeader}>
        <Text style={[styles.paramLabel, { color: colors.textPrimary }]}>{param.label}</Text>
        <Text style={[styles.paramValue, { color: changed ? colors.accent : colors.textSecondary }]}>
          {formatValue(param, shown)}
        </Text>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={param.min}
        maximumValue={param.max}
        step={param.step}
        value={shown}
        onValueChange={setLocal}
        onSlidingComplete={(v) => {
          setLocal(null);
          onCommit(param.key, v);
        }}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.border}
      />
      <Text style={[styles.hint, { color: colors.textMuted }]}>{param.hint}</Text>
    </View>
  );
}

export function AnimationSettingsCard() {
  const { client, status } = useSkelly();
  const { colors } = useTheme();
  const [values, setValues] = useState<AnimationValues | null>(null);
  const [defaults, setDefaults] = useState<AnimationValues>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const connected = useRef(false);

  const load = useCallback(() => {
    client
      .getAnimation()
      .then((r) => {
        setValues(r.settings);
        setDefaults(r.defaults);
        setError(null);
      })
      .catch((err) => setError(String(err?.message ?? err)));
  }, [client]);

  // Reload whenever we (re)connect to a skull; status updates stream in once connected.
  const hasStatus = Object.keys(status.servos).length > 0;
  useEffect(() => {
    if (hasStatus && !connected.current) load();
    connected.current = hasStatus;
  }, [hasStatus, load]);

  const commit = (key: string, v: number) => {
    setValues((prev) => (prev ? { ...prev, [key]: v } : prev));
    client.setAnimation({ [key]: v }).catch((err) => Alert.alert('Failed to save setting', String(err)));
  };

  const reset = async () => {
    setBusy(true);
    try {
      await client.resetAnimation();
      load();
    } catch (err) {
      Alert.alert('Failed to reset', String(err));
    } finally {
      setBusy(false);
    }
  };

  if (!values) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {error ? `Couldn't load settings: ${error}` : 'Connect to the skull to edit animation settings.'}
        </Text>
        <Pressable style={[styles.button, { backgroundColor: colors.accent }]} onPress={load}>
          <Text style={styles.buttonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      {ANIMATION_GROUPS.map((group) => (
        <View key={group.title} style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>{group.title}</Text>
          {group.params.map((p) => (
            <ParamRow key={p.key} param={p} value={values[p.key] ?? p.min} defaultValue={defaults[p.key]} onCommit={commit} />
          ))}
        </View>
      ))}
      <Pressable
        style={[styles.button, { backgroundColor: colors.disabled }, busy && { opacity: 0.5 }]}
        disabled={busy}
        onPress={reset}
      >
        <Text style={[styles.buttonText, { color: colors.textPrimary }]}>Reset animation to defaults</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, padding: 16, marginBottom: 14 },
  groupTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  param: { marginBottom: 10 },
  paramHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  paramLabel: { fontSize: 14, fontWeight: '600' },
  paramValue: { fontSize: 13, fontWeight: '600' },
  slider: { height: 34 },
  hint: { fontSize: 12, lineHeight: 17 },
  button: { borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 14 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
