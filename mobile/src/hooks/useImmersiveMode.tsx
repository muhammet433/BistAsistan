import { useEffect } from 'react';
import { NavigationBar } from 'expo-navigation-bar';
import { Platform } from 'react-native';

export function useImmersiveMode(enabled = true) {
  useEffect(() => {
    if (Platform.OS !== 'android' || !enabled) return;

    try {
      NavigationBar.setStyle('dark');
      NavigationBar.setHidden(true);
    } catch {
      // Cihaz desteklemiyorsa sessizce gec
    }
  }, [enabled]);
}