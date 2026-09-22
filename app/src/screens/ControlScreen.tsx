import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSkelly } from '../context/SkellyContext';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { ServoSlider } from '../components/ServoSlider';
import { SERVO_LIST } from '../api/servoConfig';

export function ControlScreen() {
  const { client, status, connectionState } = useSkelly();
  const [files, setFiles] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyFile, setBusyFile] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    try {
      setFiles(await client.getFiles());
    } catch {
      // leave the previous list in place; the empty state below covers a
      // never-loaded list
    }
  }, [client]);

  useEffect(() => {
    if (connectionState === 'connected') loadFiles();
  }, [connectionState, loadFiles]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFiles();
    setRefreshing(false);
  };

  const play = async (file: string) => {
    setBusyFile(file);
    try {
      await client.play(file);
    } finally {
      setBusyFile(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ConnectionBadge />
      </View>

      <View style={styles.nowPlaying}>
        <Text style={styles.sectionTitle}>Now playing</Text>
        <Text style={styles.nowPlayingFile}>
          {status.playing ? status.file ?? 'unknown clip' : '— nothing —'}
        </Text>
        <View style={styles.jawMeterTrack}>
          <View style={[styles.jawMeterFill, { width: `${Math.round(status.jawLevel * 100)}%` }]} />
        </View>
        <Pressable
          style={[styles.stopButton, !status.playing && styles.stopButtonDisabled]}
          disabled={!status.playing}
          onPress={() => client.stop()}
        >
          <Text style={styles.stopButtonText}>Stop</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Speech clips</Text>
      <FlatList
        data={files}
        keyExtractor={(item) => item}
        style={styles.fileList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No clips found. Drop .mp3/.wav files into data/audio/ and run
            `pio run --target uploadfs`.
          </Text>
        }
        renderItem={({ item }) => {
          const isActive = status.playing && status.file === item;
          return (
            <Pressable
              style={[styles.fileRow, isActive && styles.fileRowActive]}
              onPress={() => play(item)}
              disabled={busyFile === item}
            >
              <Text style={[styles.fileName, isActive && styles.fileNameActive]}>
                {item.replace(/^\/?audio\//, '')}
              </Text>
              <Text style={styles.filePlay}>{isActive ? '▶ playing' : '▶ play'}</Text>
            </Pressable>
          );
        }}
      />

      <Text style={styles.sectionTitle}>Manual servo control</Text>
      <View style={styles.servoList}>
        {SERVO_LIST.map((servo) => (
          <ServoSlider key={servo.name} name={servo.name} label={servo.label} min={servo.min} max={servo.max} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  header: { alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#636e72', textTransform: 'uppercase', marginTop: 16, marginBottom: 8 },
  nowPlaying: { backgroundColor: '#f5f6fa', borderRadius: 14, padding: 16 },
  nowPlayingFile: { fontSize: 18, fontWeight: '700', color: '#2d3436', marginBottom: 10 },
  jawMeterTrack: { height: 8, backgroundColor: '#dfe6e9', borderRadius: 4, overflow: 'hidden' },
  jawMeterFill: { height: '100%', backgroundColor: '#6c5ce7' },
  stopButton: { marginTop: 14, backgroundColor: '#e74c3c', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  stopButtonDisabled: { backgroundColor: '#dfe6e9' },
  stopButtonText: { color: '#fff', fontWeight: '700' },
  fileList: { maxHeight: 180 },
  empty: { color: '#95a5a6', fontSize: 13, paddingVertical: 8 },
  fileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#f5f6fa',
    borderRadius: 10,
    marginBottom: 8,
  },
  fileRowActive: { backgroundColor: '#e8e3ff' },
  fileName: { fontSize: 15, color: '#2d3436', fontWeight: '500' },
  fileNameActive: { color: '#6c5ce7', fontWeight: '700' },
  filePlay: { fontSize: 13, color: '#636e72' },
  servoList: { paddingBottom: 24 },
});
