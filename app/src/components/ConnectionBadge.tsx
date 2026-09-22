import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSkelly } from '../context/SkellyContext';

const LABELS: Record<string, string> = {
  connected: 'Connected',
  connecting: 'Connecting…',
  disconnected: 'Disconnected',
  error: 'Connection error',
};

const COLORS: Record<string, string> = {
  connected: '#2ecc71',
  connecting: '#f1c40f',
  disconnected: '#95a5a6',
  error: '#e74c3c',
};

export function ConnectionBadge() {
  const { host, connectionState } = useSkelly();
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: COLORS[connectionState] }]} />
      <Text style={styles.text}>
        {LABELS[connectionState]} · {host}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  text: { color: '#555', fontSize: 13 },
});
