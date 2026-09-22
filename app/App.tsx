import React, { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SkellyProvider } from './src/context/SkellyContext';
import { ConnectScreen } from './src/screens/ConnectScreen';
import { ControlScreen } from './src/screens/ControlScreen';
import { SpeechScreen } from './src/screens/SpeechScreen';

type Tab = 'connect' | 'control' | 'speech';

const TABS: { key: Tab; label: string }[] = [
  { key: 'connect', label: 'Connect' },
  { key: 'control', label: 'Control' },
  { key: 'speech', label: 'Speech' },
];

function AppShell() {
  const [tab, setTab] = useState<Tab>('connect');

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        {tab === 'connect' && <ConnectScreen />}
        {tab === 'control' && <ControlScreen />}
        {tab === 'speech' && <SpeechScreen />}
      </View>
      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <Pressable key={t.key} style={styles.tabButton} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SkellyProvider>
      <AppShell />
    </SkellyProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  screen: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#dfe6e9',
    backgroundColor: '#fff',
  },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabLabel: { fontSize: 13, fontWeight: '600', color: '#95a5a6' },
  tabLabelActive: { color: '#6c5ce7' },
});
