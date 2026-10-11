import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../services/api';

interface AlertItem {
  id: string;
  symbol: string;
  condition: {
    type: 'PRICE' | 'RSI';
    direction: 'ABOVE' | 'BELOW';
    threshold: number;
  };
  active: boolean;
  createdAt: string;
}

type MetricType = 'PRICE' | 'RSI';
type Direction = 'ABOVE' | 'BELOW';

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [symbol, setSymbol] = useState('');
  const [metric, setMetric] = useState<MetricType>('PRICE');
  const [direction, setDirection] = useState<Direction>('ABOVE');
  const [threshold, setThreshold] = useState('');
  const [loading, setLoading] = useState(false);

const userId = async () => {
    const raw = await AsyncStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw).userId as string;
  };

  const loadAlerts = useCallback(async () => {
    const id = await userId();
    if (!id) {
      Alert.alert('Giriş Gerekli', 'Alarm oluşturmak için giriş yapmalısınız.');
      return;
    }
    try {
      const data = await api.getAlerts();
      setAlerts(data);
    } catch {
      setAlerts([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAlerts();
    }, [loadAlerts])
  );

  const createAlert = async () => {
    const value = parseFloat(threshold);
    if (!symbol.trim() || !value || value <= 0) {
      Alert.alert('Hata', 'Hisse sembolü ve geçerli bir eşik girin.');
      return;
    }

    const id = await userId();
    if (!id) {
      Alert.alert('Giriş Gerekli', 'Alarm oluşturmak için giriş yapmalısınız.');
      return;
    }

setLoading(true);
    try {
      await api.createAlert(symbol.trim().toUpperCase(), {
        type: metric,
        direction,
        threshold: value,
      });
      setSymbol('');
      setThreshold('');
      Alert.alert('Başarılı', 'Alarm oluşturuldu.');
      loadAlerts();
    } catch {
      Alert.alert('Hata', 'Alarm oluşturulamadı.');
    } finally {
      setLoading(false);
    }
  };

  const deleteAlert = async (alertId: string) => {
    await api.deleteAlert(alertId);
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  const directionLabel = (d: Direction) => (d === 'ABOVE' ? 'üstüne çıkarsa' : 'altına inerse');
  const metricLabel = (m: MetricType) => (m === 'PRICE' ? 'Fiyat' : 'RSI');

  return (
    <ScrollView style={styles.container}>
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Yeni Alarm Oluştur</Text>

        <Text style={styles.label}>Hisse Sembolü</Text>
        <TextInput
          style={styles.input}
          value={symbol}
          onChangeText={setSymbol}
          placeholder="Örn: AKBNK.IS"
          autoCapitalize="characters"
        />

        <Text style={styles.label}>Kriter</Text>
        <View style={styles.segmentRow}>
          {(['PRICE', 'RSI'] as MetricType[]).map(m => (
            <TouchableOpacity
              key={m}
              style={[styles.segment, metric === m && styles.segmentActive]}
              onPress={() => setMetric(m)}
            >
              <Text style={[styles.segmentText, metric === m && styles.segmentTextActive]}>
                {metricLabel(m)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Koşul</Text>
        <View style={styles.segmentRow}>
          {(['ABOVE', 'BELOW'] as Direction[]).map(d => (
            <TouchableOpacity
              key={d}
              style={[styles.segment, direction === d && styles.segmentActive]}
              onPress={() => setDirection(d)}
            >
              <Text style={[styles.segmentText, direction === d && styles.segmentTextActive]}>
                {directionLabel(d)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Eşik Değeri</Text>
        <TextInput
          style={styles.input}
          value={threshold}
          onChangeText={setThreshold}
          placeholder={metric === 'PRICE' ? 'Örn: 75.50' : 'Örn: 30'}
          keyboardType="numeric"
        />

        <TouchableOpacity
          style={[styles.createBtn, loading && styles.createBtnDisabled]}
          onPress={createAlert}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createBtnText}>Alarmı Oluştur</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.listTitle}>Mevcut Alarmlar</Text>
      {alerts.length === 0 ? (
        <Text style={styles.emptyText}>Henüz alarm oluşturmadınız.</Text>
      ) : (
        alerts.map(alert => (
          <View key={alert.id} style={styles.alertCard}>
            <View style={styles.alertInfo}>
              <Text style={styles.alertSymbol}>
                {alert.symbol.replace('.IS', '')}
              </Text>
              <Text style={styles.alertCondition}>
                {metricLabel(alert.condition.type)} {directionLabel(alert.condition.direction)}{' '}
                {alert.condition.threshold}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => deleteAlert(alert.id)}
            >
              <Text style={styles.deleteText}>Sil</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      <Text style={styles.info}>
        Alarmlar 15 dakikada bir kontrol edilir ve tetiklendiğinde uygulama
        üzerinden bildirim gönderilir.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 16,
  },
  label: {
    color: '#666',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: '#4a90d9' },
  segmentText: { color: '#666', fontWeight: '600', fontSize: 13 },
  segmentTextActive: { color: '#fff' },
  createBtn: {
    backgroundColor: '#4a90d9',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  listTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginTop: 24,
    marginBottom: 10,
  },
  emptyText: { color: '#888', fontStyle: 'italic' },
  alertCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  alertInfo: { flex: 1 },
  alertSymbol: { fontSize: 16, fontWeight: 'bold', color: '#1a1a2e' },
  alertCondition: { color: '#666', fontSize: 13, marginTop: 2 },
  deleteBtn: { paddingHorizontal: 14, paddingVertical: 6 },
  deleteText: { color: '#d32f2f', fontWeight: '600' },
  info: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    fontStyle: 'italic',
    lineHeight: 18,
  },
});

