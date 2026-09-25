import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useSkelly } from '../context/SkellyContext';
import { useTheme } from '../theme/ThemeContext';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { ServoSlider } from '../components/ServoSlider';
import { VISIBLE_SERVO_LIST } from '../api/servoConfig';

// Only extensions the firmware's AudioPlayer/upload sanitizer accept
// (lib/AudioPlayer, lib/ControlAPI's sanitizeAudioFilename).
const ALLOWED_EXTENSIONS = /\.(mp3|wav)$/i;

export function ControlScreen() {
  const { client, status, connectionState } = useSkelly();
  const { colors } = useTheme();
  const [files, setFiles] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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

  const uploadClip = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    if (!ALLOWED_EXTENSIONS.test(asset.name)) {
      Alert.alert('Unsupported file', 'Skelly can only play .mp3 or .wav clips.');
      return;
    }

    setUploading(true);
    try {
      await client.uploadFile(asset.uri, asset.name, asset.mimeType ?? 'application/octet-stream');
      await loadFiles();
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <ConnectionBadge />
      </View>

      <View style={[styles.nowPlaying, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Now playing</Text>
        <Text style={[styles.nowPlayingFile, { color: colors.textPrimary }]}>
          {status.playing ? status.file ?? 'unknown clip' : '— nothing —'}
        </Text>
        <View style={[styles.jawMeterTrack, { backgroundColor: colors.border }]}>
          <View style={[styles.jawMeterFill, { width: `${Math.round(status.jawLevel * 100)}%`, backgroundColor: colors.accent }]} />
        </View>
        <Pressable
          style={[styles.stopButton, { backgroundColor: colors.danger }, !status.playing && { backgroundColor: colors.disabled }]}
          disabled={!status.playing}
          onPress={() => client.stop()}
        >
          <Text style={styles.stopButtonText}>Stop</Text>
        </Pressable>
      </View>

      <View style={styles.clipsHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Speech clips</Text>
        <Pressable
          style={[
            styles.uploadButton,
            { backgroundColor: colors.accent },
            (uploading || connectionState !== 'connected') && { backgroundColor: colors.disabled },
          ]}
          onPress={uploadClip}
          disabled={uploading || connectionState !== 'connected'}
        >
          <Text style={styles.uploadButtonText}>{uploading ? 'Uploading…' : '+ Upload clip'}</Text>
        </Pressable>
      </View>
      <FlatList
        data={files}
        keyExtractor={(item) => item}
        style={styles.fileList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            No clips found. Upload a recorded .mp3/.wav above, or drop files
            into data/audio/ and run `pio run --target uploadfs`.
          </Text>
        }
        renderItem={({ item }) => {
          const isActive = status.playing && status.file === item;
          return (
            <Pressable
              style={[
                styles.fileRow,
                { backgroundColor: colors.surface },
                isActive && { backgroundColor: colors.surfaceAlt },
              ]}
              onPress={() => play(item)}
              disabled={busyFile === item}
            >
              <Text
                style={[
                  styles.fileName,
                  { color: colors.textPrimary },
                  isActive && { color: colors.accent, fontWeight: '700' },
                ]}
              >
                {item.replace(/^\/?audio\//, '')}
              </Text>
              <Text style={[styles.filePlay, { color: colors.textSecondary }]}>{isActive ? '▶ playing' : '▶ play'}</Text>
            </Pressable>
          );
        }}
      />

      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Manual servo control</Text>
      <View style={styles.servoList}>
        {VISIBLE_SERVO_LIST.map((servo) => (
          <ServoSlider key={servo.name} name={servo.name} label={servo.label} min={servo.min} max={servo.max} rest={servo.rest} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginTop: 16, marginBottom: 8 },
  clipsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  uploadButton: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  uploadButtonText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  nowPlaying: { borderRadius: 14, padding: 16 },
  nowPlayingFile: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  jawMeterTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  jawMeterFill: { height: '100%' },
  stopButton: { marginTop: 14, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  stopButtonText: { color: '#fff', fontWeight: '700' },
  fileList: { maxHeight: 180 },
  empty: { fontSize: 13, paddingVertical: 8 },
  fileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  fileName: { fontSize: 15, fontWeight: '500' },
  filePlay: { fontSize: 13 },
  servoList: { paddingBottom: 24 },
});
