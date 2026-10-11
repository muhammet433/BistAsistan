import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../services/api';
import { colors, spacing, radius, typography, shadows } from '../../theme';
import { EmptyState, ScoreRing } from '../../components/ui';

const FILTERS = [
  { key: 'ten', label: 'En İyi 10' },
  { key: 'healthyBuy', label: 'Sağlıklı Alış' },
  { key: 'buy', label: 'Tüm Alış' },
] as const;

function PickCard({ item, rank, index, onPress }: any) {
  const opacity = React.useMemo(() => new Animated.Value(0), []);
  const translateY = React.useMemo(() => new Animated.Value(20), []);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 340,
        delay: Math.min(index * 60, 400),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, { toValue: 0, damping: 16, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY, index]);

  const participationGood = item.isHealthy;
  const candleUp = item.candleTrend === 'YUKARI';
  const volumeUp = item.volumeRatio > 1.15;

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={styles.rankRow}>
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>{rank}</Text>
          </View>
          <Text style={styles.symbol}>{item.symbol.replace('.IS', '')}</Text>
          {item.sector && <Text style={styles.sector} numberOfLines={1}>· {item.sector}</Text>}
          <View style={styles.spacer} />
          <ScoreRing score={item.compositeScore} size={42} strokeWidth={4} />
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.price}>{item.price?.toFixed(2)} TL</Text>
          <View style={styles.actionTag}>
            <Text style={styles.actionText}>ALIŞ</Text>
          </View>
        </View>

        <View style={styles.chips}>
          <Chip
            label="Sinyal"
            value={`${item.technicalScore}`}
            tone={item.technicalScore >= 70 ? 'green' : 'amber'}
          />
          <Chip
            label="Mum"
            value={item.candleTrend}
            tone={candleUp ? 'green' : item.candleTrend === 'AŞAĞI' ? 'red' : 'neutral'}
          />
          <Chip
            label="Hacim"
            value={volumeUp ? 'Yüksek' : volumeRatioDown(item.volumeRatio) ? 'Düşük' : 'Normal'}
            tone={volumeUp ? 'green' : volumeRatioDown(item.volumeRatio) ? 'red' : 'neutral'}
          />
          <Chip
            label="Katılım"
            value={`%${item.participationRatio?.toFixed(0) ?? '?'}`}
            tone={participationGood ? 'green' : 'red'}
          />
        </View>

        <View style={styles.reasonBox}>
          {item.reasons?.map((r: string, i: number) => (
            <Text key={i} style={styles.reason}>• {r}</Text>
          ))}
        </View>

        {!participationGood && (
          <View style={styles.warnBox}>
            <Text style={styles.warnText}>Düşük katılım — dikkatli ol</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function volumeRatioDown(r: number) {
  return r > 0 && r < 0.85;
}

function Chip({ label, value, tone }: { label: string; value: string; tone: string }) {
  const color =
    tone === 'green' ? colors.green : tone === 'red' ? colors.red : tone === 'amber' ? colors.amber : colors.textSecondary;
  const bg =
    tone === 'green' ? colors.greenSoft : tone === 'red' ? colors.redSoft : tone === 'amber' ? colors.amberSoft : colors.surfaceElevated;

  return (
    <View style={[styles.chip, { backgroundColor: bg, borderColor: `${color}44` }]}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={[styles.chipValue, { color }]}>{value}</Text>
    </View>
  );
}

export default function TopPicksScreen() {
  const [picks, setPicks] = useState<any[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('ten');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [meta, setMeta] = useState<any>(null);
  const router = useRouter();

  const load = useCallback(async (f: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.getTopPicks(f, 25);
      setPicks(res.data || []);
      setMeta(res.meta);
    } catch {
      setPicks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(filter);
  }, [load]);

  const changeFilter = (key: string) => {
    setFilter(key as any);
    load(key);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Hisseler taranıyor</Text>
          <Text style={styles.loadingSub}>Sinyal · Mum · Hacim · Katılım</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Fırsatlar</Text>
        {meta && (
          <Text style={styles.subtitle}>
            {meta.scanned} hisse tarandı · {meta.totalBuys} alış sinyali
          </Text>
        )}

        <View style={styles.filterRow}>
          {FILTERS.map(f => (
            <Pressable
              key={f.key}
              onPress={() => changeFilter(f.key)}
              style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
            >
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={picks}
        keyExtractor={(item: any) => item.symbol}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <PickCard
            item={item}
            rank={index + 1}
            index={index}
            onPress={() => router.push(`/detail/${item.symbol}`)}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(filter, true)}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="◈"
            title="Fırsat bulunamadı"
            message="Şu an yeterli sayıda alış sinyali yok. Farklı filtreyi dene"
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { ...typography.body, color: colors.textSecondary, marginTop: 14 },
  loadingSub: { ...typography.caption, color: colors.textTertiary, marginTop: 4 },

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

  filterRow: { flexDirection: 'row', gap: 6, marginTop: spacing.lg, flexWrap: 'wrap' },
  filterBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
  },
  filterBtnActive: { backgroundColor: colors.accent },
  filterText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  filterTextActive: { color: colors.textInverse },

  list: { padding: spacing.md, paddingBottom: spacing.xxxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardPressed: { backgroundColor: colors.surfaceHover, transform: [{ scale: 0.99 }] },

  rankRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { fontSize: 11, fontWeight: '800', color: colors.accent },
  symbol: { ...typography.heading, color: colors.textPrimary },
  sector: { fontSize: 11, color: colors.textTertiary, flex: 1 },
  spacer: { flex: 1 },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  price: { ...typography.title, color: colors.textPrimary },
  actionTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.greenSoft,
  },
  actionText: { fontSize: 11, fontWeight: '800', color: colors.green },

  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.md,
  },
  chip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 62,
  },
  chipLabel: { fontSize: 9, color: colors.textTertiary },
  chipValue: { fontSize: 11, fontWeight: '800', marginTop: 1 },

  reasonBox: { marginTop: spacing.md, gap: 3 },
  reason: { fontSize: 11, color: colors.textSecondary, lineHeight: 16 },

  warnBox: {
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.redSoft,
  },
  warnText: { fontSize: 11, fontWeight: '700', color: colors.red },
});
