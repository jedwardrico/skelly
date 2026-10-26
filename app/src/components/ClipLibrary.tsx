import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useSkelly } from '../context/SkellyContext';
import { useTheme } from '../theme/ThemeContext';

// Only extensions the firmware's AudioPlayer/upload sanitizer accept
// (lib/AudioPlayer, lib/ControlAPI's sanitizeAudioFilename).
const ALLOWED_EXTENSIONS = /\.(mp3|wav)$/i;

// The skull's stored speech clips: list, play, and upload a new one from the phone.
export function ClipLibrary() {
  const { client, status, connectionState } = useSkelly();
  const { colors } = useTheme();
  const [files, setFiles] = useState<string[]>([]);
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

  const play = async (file: string) => {
    setBusyFile(file);
    try {
      await client.play(file);
    } finally {
      setBusyFile(null);
    }
  };

  const confirmDelete = (file: string) => {
    const label = file.replace(/^\/?audio\//, '');
    Alert.alert('Delete clip?', `${label} will be removed from the skull.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await client.deleteFile(file);
            await loadFiles();
          } catch (err) {
            Alert.alert('Delete failed', err instanceof Error ? err.message : String(err));
          }
        },
      },
    ]);
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

  const connected = connectionState === 'connected';

  return (
    <View>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textSecondary }]}>Speech clips</Text>
        <View style={styles.headerButtons}>
          <Pressable
            style={[styles.smallButton, { borderColor: colors.border }, !connected && { opacity: 0.5 }]}
            onPress={loadFiles}
            disabled={!connected}
          >
            <Text style={[styles.smallButtonText, { color: colors.textPrimary }]}>Refresh</Text>
          </Pressable>
          <Pressable
            style={[
              styles.smallButton,
              { backgroundColor: colors.accent, borderColor: colors.accent },
              (uploading || !connected) && { backgroundColor: colors.disabled, borderColor: colors.disabled },
            ]}
            onPress={uploadClip}
            disabled={uploading || !connected}
          >
            <Text style={[styles.smallButtonText, { color: '#fff' }]}>{uploading ? 'Uploading…' : '+ Upload clip'}</Text>
          </Pressable>
        </View>
      </View>

      {files.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          No clips found. Upload a recorded .mp3/.wav above, or drop files into
          data/audio/ and run `pio run --target uploadfs`.
        </Text>
      ) : (
        files.map((item) => {
          const isActive = status.playing && status.file === item;
          return (
            <View
              key={item}
              style={[styles.fileRow, { backgroundColor: colors.surface }, isActive && { backgroundColor: colors.surfaceAlt }]}
            >
              <Pressable style={styles.fileMain} onPress={() => play(item)} disabled={busyFile === item}>
                <Text
                  style={[styles.fileName, { color: colors.textPrimary }, isActive && { color: colors.accent, fontWeight: '700' }]}
                >
                  {item.replace(/^\/?audio\//, '')}
                </Text>
                <Text style={[styles.filePlay, { color: colors.textSecondary }]}>{isActive ? '▶ playing' : '▶ play'}</Text>
              </Pressable>
              <Pressable style={styles.deleteButton} onPress={() => confirmDelete(item)} hitSlop={8}>
                <Text style={[styles.deleteText, { color: colors.danger }]}>Delete</Text>
              </Pressable>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 8 },
  title: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  headerButtons: { flexDirection: 'row', gap: 8 },
  smallButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  smallButtonText: { fontWeight: '700', fontSize: 12 },
  empty: { fontSize: 13, paddingVertical: 8 },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    marginBottom: 8,
  },
  fileMain: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 8,
  },
  deleteButton: { paddingVertical: 12, paddingHorizontal: 14 },
  deleteText: { fontSize: 13, fontWeight: '700' },
  fileName: { fontSize: 15, fontWeight: '500' },
  filePlay: { fontSize: 13 },
});
