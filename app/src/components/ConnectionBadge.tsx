import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSkelly } from '../context/SkellyContext';
import { useTheme } from '../theme/ThemeContext';

const LABELS: Record<string, string> = {
  connected: 'Connected',
  connecting: 'Connecting…',
  disconnected: 'Disconnected',
  error: 'Connection error',
};

export function ConnectionBadge() {
  const { host, connectionState } = useSkelly();
  const { colors } = useTheme();

  const dotColors: Record<string, string> = {
    connected: colors.success,
    connecting: colors.warning,
    disconnected: colors.textMuted,
    error: colors.danger,
  };

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: dotColors[connectionState] }]} />
      <Text style={[styles.text, { color: colors.textSecondary }]}>
        {LABELS[connectionState]} · {host}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  text: { fontSize: 13 },
});
