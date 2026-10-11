import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { api } from '../../services/api';

type NotificationStatus = {
  supported: boolean;
  permission: string;
  token: string | null;
};

export default function NotificationSettingsScreen() {
  const [status, setStatus] = useState<NotificationStatus>({
    supported: false,
    permission: 'Bilinmiyor',
    token: null,
  });
  const [checking, setChecking] = useState(true);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    try {
      const Notifications = await import('expo-notifications');
      const Device = await import('expo-device');

      const { status: permission } = await Notifications.getPermissionsAsync();

      setStatus({
        supported: true,
        permission,
        token: null,
      });

      if (!Device.default.isDevice) {
        Alert.alert(
          'Bilgi',
          'Push bildirimleri sadece fiziksel cihazda çalışır.'
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Bilinmeyen hata';

      setStatus({
        supported: false,
        permission: 'Desteklenmiyor',
        token: null,
      });

      if (message.includes('expo-notifications')) {
        Alert.alert(
          'Expo Go Limiti',
          'Push bildirimleri Expo Go ile çalışmaz (SDK 53+ kaldırıldı).\n\n' +
            'Gerçek bildirim almak için uygulamayı APK olarak yüklemen gerekiyor.\n' +
            'Uygulama şu an tüm diğer özellikleriyle çalışıyor.'
        );
      }
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const saveToken = useCallback(async () => {
    try {
      const Notifications = await import('expo-notifications');
      const Device = await import('expo-device');

      if (!Device.default.isDevice) {
        Alert.alert('Hata', 'Sadece fiziksel cihazda çalışır.');
        return;
      }

      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Hata', 'Bildirim izni verilmedi.');
        return;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
      });

      await api.updateFCMToken(tokenData.data);

      setStatus(prev => ({ ...prev, token: tokenData.data }));
      Alert.alert('Başarılı', 'Bildirim token kaydedildi.');
    } catch {
      Alert.alert('Hata', 'Token alınamadı.');
    }
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bildirim Ayarları</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Ortam</Text>
        <Text
          style={[
            styles.value,
            status.supported ? styles.ok : styles.warn,
          ]}
        >
          Expo Go (build gerekli)
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>İzin Durumu</Text>
        <Text style={styles.value}>{status.permission}</Text>
      </View>

      {status.token && (
        <View style={styles.card}>
          <Text style={styles.label}>Kayıtlı Token</Text>
          <Text style={styles.token} numberOfLines={2}>
            {status.token}
          </Text>
        </View>
      )}

      {checking ? (
        <ActivityIndicator style={styles.loader} color="#4a90d9" />
      ) : (
        <TouchableOpacity style={styles.button} onPress={checkStatus}>
          <Text style={styles.buttonText}>Durumu Kontrol Et</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.button, styles.secondary]}
        onPress={saveToken}
      >
        <Text style={styles.buttonText}>Token Al ve Kaydet</Text>
      </TouchableOpacity>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Neden çalışmıyor?</Text>
        <Text style={styles.infoText}>
          Expo, SDK 53 surumunde Android push bildirimlerini Expo Go&apos;dan
          kaldirdi. Bu uygulamanin geri kalan tum ozellikleri calisir.
        </Text>
        <Text style={styles.infoText}>
          Gerçek bildirim almak için APK kurulumu gerekiyor. O zaman alarmlar
          ve sinyaller telefonuna düşer.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20 },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 20,
    marginTop: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  label: { color: '#888', fontSize: 13, marginBottom: 4 },
  value: { fontSize: 16, fontWeight: '600', color: '#333' },
  ok: { color: '#4caf50' },
  warn: { color: '#ff9800' },
  token: {
    fontSize: 12,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  loader: { marginVertical: 16 },
  button: {
    backgroundColor: '#4a90d9',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  secondary: { backgroundColor: '#7b61ff' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  infoCard: {
    backgroundColor: '#fff8e1',
    borderRadius: 10,
    padding: 16,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
  },
  infoTitle: {
    fontWeight: 'bold',
    color: '#e65100',
    marginBottom: 8,
  },
  infoText: { color: '#666', fontSize: 13, lineHeight: 20, marginBottom: 6 },
});