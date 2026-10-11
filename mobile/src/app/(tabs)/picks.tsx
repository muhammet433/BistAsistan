import React, { useCallback, useMemo, useState } from 'react';
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

interface Pick {
  symbol: string;
  name: string;
  price: number;
  technicalScore: number;
  candleScore: number;
  action: string;
  confidence: number;
  rsi: number | null;
  adx: number | null;
  trend: string;
  risk: string;
  participationRatio: number | null;
  participationLabel: string;
  participationTone: string;
  isHealthy: boolean;
  pe: number | null;
  pb: number | null;
  roe: number | null;
  dividendYield: number | null;
  sector: string | null;
  compositeScore: number;
  reasons: string[];
  warnings: string[];
}

const FILTERS = [
  { key: 'top', label: 'En Iyi' },
  { key: 'healthyBuy', label: 'Saglikli Alis' },
  { key: 'buy', label: 'Tum Alis' },
  { key: 'healthy', label: 'Katilimli' },
] as const;

function PickCard({ item, rank, index, onPress }: any) {
  const opacity = React.useMemo(() => new Animated.Value(0), []);
  const translateY = React.useMemo(() => new Animated.Value(18), []);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        delay: Math.min(index * 45, 350),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, { toValue: 0, damping: 15, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY, index]);

  const tone = item.participationTone;
  const toneColor =
    tone === 'green' ? colors.green : tone === 'amber' ? colors.amber : tone === 'red' ? colors.red : colors.textTertiary;
  const toneBg =
    tone === 'green' ? colors.greenSoft : tone === 'amber' ? colors.amberSoft : tone === 'red' ? colors.redSoft : colors.surfaceElevated;

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={[styles.rankBadge, { backgroundColor: colors.accent + '22' }]}>
          <Text style={styles.rankText}>{rank}</Text>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <View style={{ flex: 1 }}>
              <View style={styles.symbolRow}>
                <Text style={styles.symbol}>{item.symbol.replace('.IS', '')}</Text>
                <View style={[styles.actionTag, item.action === 'BUY' ? styles.actionBuy : styles.actionHold]}>
                  <Text style={[styles.actionText, { color: item.action === 'BUY' ? colors.green : colors.amber }]}>
                    {item.action === 'BUY' ? 'ALIŞ' : 'BEKLE'}
                  </Text>
                </View>
              </View>
              {item.sector && <Text style={styles.sector}>{item.sector}</Text>}
            </View>

            <ScoreRing score={item.compositeScore} size={46} strokeWidth={4} />
          </View>

          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Teknik</Text>
              <Text style={styles.metricValue}>{item.technicalScore}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Katılım</Text>
              <Text style={[styles.metricValue, { color: toneColor }]}>
                {item.participationRatio ? item.participationRatio.toFixed(0) + '%' : '—'}
              </Text>
            </View>
            {item.roe !== null && (
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>ROE</Text>
                <Text style={[styles.metricValue, { color: item.roe > 0 ? colors.green : colors.red }]}>
                  %{item.roe.toFixed(0)}
                </Text>
              </View>
            )}
            {item.pe !== null && (
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>F/K</Text>
                <Text style={styles.metricValue}>{item.pe.toFixed(1)}</Text>
              </View>
            )}
          </View>

          <View style={styles.footer}>
            <View style={[styles.partTag, { backgroundColor: toneBg, borderColor: toneColor + '55' }]}>
              <Text style={[styles.partText, { color: toneColor }]}>{item.participationLabel}</Text>
            </View>
            <Text style={styles.price}>{item.price?.toFixed(2)} TL</Text>
          </View>

          {item.reasons?.length > 0 && (
            <View style={styles.reasons}>
              {item.reasons.slice(0, 2).map((r: string, i: number) => (
                <Text key={i} style={styles.reasonText}>• {r}</Text>
              ))}
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function TopPicksScreen() {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('top');
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

  const changeFilter = (key: string) => {
    setFilter(key as any);
    load(key);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Tum hisseler taraniyor</Text>
          <Text style={styles.loadingSub}>495 hisse · teknik + katılım analizi</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Firsatlar</Text>
        {meta && (
          <Text style={styles.subtitle}>
            {meta.scanned} hisse tarandi · {meta.totalBuys} alis sinyali
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
        keyExtractor={item => item.symbol}
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
            title="Sonuc bulunamadi"
            message="Su an guclu alis sinyali olan hisse yok. Filtreyi degistirmeyi dene"
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
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterBtnActive: { backgroundColor: colors.accent },
  filterText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  filterTextActive: { color: colors.textInverse },

  list: { padding: spacing.md, paddingBottom: spacing.xxxl },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardPressed: { backgroundColor: colors.surfaceHover, transform: [{ scale: 0.99 }] },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rankText: { fontSize: 12, fontWeight: '800', color: colors.accent },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  symbolRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  symbol: { ...typography.heading, color: colors.textPrimary },
  actionTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  actionBuy: { backgroundColor: colors.greenSoft },
  actionHold: { backgroundColor: colors.amberSoft },
  actionText: { fontSize: 9, fontWeight: '800' },
  sector: { fontSize: 11, color: colors.textTertiary, marginTop: 3 },

  metrics: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  metric: { alignItems: 'center', minWidth: 48 },
  metricLabel: { fontSize: 9, color: colors.textTertiary },
  metricValue: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  partTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  partText: { fontSize: 10, fontWeight: '800' },
  price: { ...typography.subheading, color: colors.textPrimary },

  reasons: { marginTop: spacing.sm, gap: 2 },
  reasonText: { fontSize: 10, color: colors.textTertiary, lineHeight: 14 },
});