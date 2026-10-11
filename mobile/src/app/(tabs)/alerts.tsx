import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../services/api';
import { colors, spacing, radius, typography, shadows } from '../../theme';
import { EmptyState } from '../../components/ui';

type MetricType = 'PRICE' | 'RSI';
type Direction = 'ABOVE' | 'BELOW';

interface AlertItem {
  id: string;
  symbol: string;
  condition: { type: MetricType; direction: Direction; threshold: number };
  active: boolean;
}

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [symbol, setSymbol] = useState('');
  const [metric, setMetric] = useState<MetricType>('PRICE');
  const [direction, setDirection] = useState<Direction>('ABOVE');
  const [threshold, setThreshold] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const getUserId = useCallback(async () => {
    const raw = await AsyncStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw).userId as string;
  }, []);

  const load = useCallback(async () => {
    const id = await getUserId();
    if (!id) {
      router.replace('/auth');
      return;
    }
    try {
      const data = await api.getAlerts();
      setAlerts(data);
    } catch {
      setAlerts([]);
    }
  }, [getUserId, router]);

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load])
  );

  const createAlert = async () => {
    const value = parseFloat(threshold);
    if (!symbol.trim() || !Number.isFinite(value) || value <= 0) {
      Alert.alert('Hata', 'Hisse sembolu ve gecerli bir esik gir');
      return;
    }

    setSaving(true);
    try {
      await api.createAlert(symbol.trim().toUpperCase(), {
        type: metric,
        direction,
        threshold: value,
      });
      setSymbol('');
      setThreshold('');
      load();
    } catch {
      Alert.alert('Hata', 'Alarm olusturulamadi');
    } finally {
      setSaving(false);
    }
  };

  const removeAlert = (alertId: string) => {
    Alert.alert('Alarmı sil', 'Bu alarm kaldirilsin mi?', [
      { text: 'Vazgec', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await api.deleteAlert(alertId);
          setAlerts(prev => prev.filter(a => a.id !== alertId));
        },
      },
    ]);
  };

  const directionLabel = (d: Direction) => (d === 'ABOVE' ? 'üstüne çıkarsa' : 'altına inerse');
  const metricLabel = (m: MetricType) => (m === 'PRICE' ? 'Fiyat' : 'RSI');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Alarmlar</Text>
          <Text style={styles.subtitle}>Fiyat ve RSI esikleri</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Yeni alarm olustur</Text>

          <Text style={styles.label}>Hisse sembolu</Text>
          <TextInput
            style={styles.input}
            value={symbol}
            onChangeText={setSymbol}
            placeholder="AKBNK.IS"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <Text style={styles.label}>Kriter</Text>
          <View style={styles.segmentRow}>
            {(['PRICE', 'RSI'] as MetricType[]).map(m => (
              <Pressable
                key={m}
                onPress={() => setMetric(m)}
                style={[styles.segment, metric === m && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, metric === m && styles.segmentTextActive]}>
                  {metricLabel(m)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Koşul</Text>
          <View style={styles.segmentRow}>
            {(['ABOVE', 'BELOW'] as Direction[]).map(d => (
              <Pressable
                key={d}
                onPress={() => setDirection(d)}
                style={[
                  styles.segment,
                  direction === d && (d === 'ABOVE' ? styles.segmentUp : styles.segmentDown),
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    direction === d && styles.segmentTextActive,
                  ]}
                >
                  {d === 'ABOVE' ? 'Üstüne çıkarsa' : 'Altına inerse'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Eşik değeri</Text>
          <TextInput
            style={styles.input}
            value={threshold}
            onChangeText={setThreshold}
            placeholder={metric === 'PRICE' ? '75.50' : '30'}
            placeholderTextColor={colors.textTertiary}
            keyboardType="numeric"
          />

          <Pressable
            onPress={createAlert}
            disabled={saving}
            style={({ pressed }) => [
              styles.createBtn,
              saving && styles.createBtnDisabled,
              pressed && !saving && styles.createBtnPressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={styles.createBtnText}>Alarmı Oluştur</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.listTitle}>Aktif alarmlar ({alerts.length})</Text>

        {alerts.length === 0 ? (
          <EmptyState
            icon="🔔"
            title="Henuz alarm yok"
            message="Yukaridaki formu doldurarak fiyat veya RSI alarmi kurabilirsin"
          />
        ) : (
          alerts.map((alert, i) => (
            <AlertRow
              key={alert.id}
              alert={alert}
              index={i}
              onRemove={() => removeAlert(alert.id)}
              directionLabel={directionLabel}
              metricLabel={metricLabel}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function AlertRow({
  alert,
  index,
  onRemove,
  directionLabel,
  metricLabel,
}: any) {
  const opacity = React.useMemo(() => new Animated.Value(0), []);
  const translateY = React.useMemo(() => new Animated.Value(12), []);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        delay: Math.min(index * 45, 250),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, { toValue: 0, damping: 14, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY, index]);

  const isUp = alert.condition.direction === 'ABOVE';
  const tone = isUp
    ? { bg: colors.greenSoft, border: colors.greenBorder, color: colors.green }
    : { bg: colors.redSoft, border: colors.redBorder, color: colors.red };

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <View style={[styles.alertCard, !alert.active && styles.alertCardOff]}>
        <View style={styles.alertLeft}>
          <View style={styles.alertSymbolRow}>
            <Text style={styles.alertSymbol}>
              {alert.symbol.replace('.IS', '')}
            </Text>
            {!alert.active && (
              <View style={styles.inactiveTag}>
                <Text style={styles.inactiveText}>TETIKLENDI</Text>
              </View>
            )}
          </View>
          <Text style={styles.alertCondition}>
            {metricLabel(alert.condition.type)} {directionLabel(alert.condition.direction)}{' '}
            <Text style={[styles.alertThreshold, { color: tone.color }]}>
              {alert.condition.threshold}
            </Text>
          </Text>
        </View>

        <Pressable onPress={onRemove} hitSlop={10} style={styles.deleteBtn}>
          <Text style={styles.deleteIcon}>×</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxxl },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },

  formCard: {
    margin: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  sectionTitle: { ...typography.heading, color: colors.textPrimary, marginBottom: spacing.md },
  label: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: 6,
    marginTop: spacing.md,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentRow: { flexDirection: 'row', gap: spacing.sm },
  segment: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentActive: { backgroundColor: colors.accent },
  segmentUp: { backgroundColor: colors.green },
  segmentDown: { backgroundColor: colors.red },
  segmentText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  segmentTextActive: { color: colors.textInverse },

  createBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: 15,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  createBtnPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText: { color: colors.textInverse, fontWeight: '800', fontSize: 15 },

  listTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },

  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  alertCardOff: { opacity: 0.55 },
  alertLeft: { flex: 1 },
  alertSymbolRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  alertSymbol: { ...typography.subheading, color: colors.textPrimary },
  inactiveTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.amberSoft,
  },
  inactiveText: { fontSize: 8, fontWeight: '800', color: colors.amber },
  alertCondition: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  alertThreshold: { fontWeight: '800' },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.redSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIcon: { color: colors.red, fontSize: 18, fontWeight: '700', lineHeight: 20 },
});