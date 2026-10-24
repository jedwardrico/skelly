import React, { useRef, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSkelly } from '../context/SkellyContext';
import { useTheme } from '../theme/ThemeContext';
import { ConnectionBadge } from '../components/ConnectionBadge';

// Live view of the skull's serial output (what `pio device monitor` would
// show), streamed over the WebSocket. The backlog survives tab switches
// because it lives in SkellyContext.
export function LogsScreen() {
  const { logs, clearLogs, connectionState } = useSkelly();
  const { colors } = useTheme();
  const [follow, setFollow] = useState(true);
  const listRef = useRef<FlatList>(null);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <ConnectionBadge />
        <View style={styles.buttons}>
          <Pressable
            style={[styles.button, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
            onPress={() => setFollow((f) => !f)}
          >
            <Text style={[styles.buttonText, { color: colors.textPrimary }]}>
              {follow ? 'Pause' : 'Follow'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.button, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
            onPress={clearLogs}
          >
            <Text style={[styles.buttonText, { color: colors.textPrimary }]}>Clear</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        ref={listRef}
        style={[styles.list, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
        data={logs}
        keyExtractor={(l) => String(l.seq)}
        renderItem={({ item }) => (
          <Text selectable style={[styles.line, { color: colors.textSecondary }]}>
            {item.text}
          </Text>
        )}
        onContentSizeChange={() => {
          if (follow) listRef.current?.scrollToEnd({ animated: false });
        }}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            {connectionState === 'connected'
              ? 'No log output yet.'
              : 'Connect to the skull to see its serial output.'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  buttons: { flexDirection: 'row', gap: 8 },
  button: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  buttonText: { fontSize: 13, fontWeight: '600' },
  list: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 8 },
  line: {
    fontSize: 11,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    paddingVertical: 1,
  },
  empty: { fontSize: 13, textAlign: 'center', marginTop: 24 },
});
