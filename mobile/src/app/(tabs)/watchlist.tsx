import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../services/api';
import { marketSocket, ConnectionState, Quote } from '../../services/marketSocket';
import { colors, spacing, radius, typography, shadows } from '../../theme';
import {
  AnimatedNumber,
  ChangeBadge,
  Sparkline,
  EmptyState,
  SectionHeader,
} from '../../components/ui';

function WatchCard({
  item,
  index,
  onPress,
  onRemove,
}: {
  item: Quote;
  index: number;
  onPress: () => void;
  onRemove: () => void;
}) {
  const opacity = React.useMemo(() => new Animated.Value(0), []);
  const translateY = React.useMemo(() => new Animated.Value(16), []);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        delay: Math.min(index * 50, 300),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        damping: 14,
        stiffness: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, index]);

  const positive = (item.changePercent || 0) >= 0;

  const sparkData = useMemo(() => {
    const base = item.price || 1;
    const change = (item.changePercent || 0) / 100;
    return Array.from({ length: 14 }, (_, i) => {
      const t = i / 13;
      const trend = base * (1 - change + change * t);
      const noise = base * 0.005 * Math.sin(i * 2.1);
      return trend + noise;
    });
  }, [item.price, item.changePercent]);

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }],
      }}
    >
      <Pressable
        onPress={onPress}
        onLongPress={onRemove}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={styles.cardGlow} />

        <View style={styles.cardTop}>
          <View style={styles.cardLeft}>
            <Text style={styles.symbol}>{item.symbol.replace('.IS', '')}</Text>
            <Text style={styles.name} numberOfLines={1}>
              {item.name || '—'}
            </Text>
          </View>
          <Pressable onPress={onRemove} hitSlop={12} style={styles.removeBtn}>
            <Text style={styles.removeIcon}>×</Text>
          </Pressable>
        </View>

        <View style={styles.cardBottom}>
          <View>
            <AnimatedNumber
              value={item.price || 0}
              decimals={2}
              style={[styles.price, { color: positive ? colors.green : colors.red }]}
            />
            <Text style={styles.tryLabel}>TL</Text>
          </View>

          <Sparkline
            data={sparkData}
            width={70}
            height={30}
            color={positive ? colors.green : colors.red}
          />

          <ChangeBadge value={item.changePercent || 0} size="md" />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function WatchlistScreen() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const router = useRouter();

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        router.replace('/auth');
        return;
      }

      const symbols = await api.getWatchlist();
      if (!symbols || symbols.length === 0) {
        setQuotes([]);
        return;
      }

      const settled = await Promise.allSettled(
        symbols.map((symbol: string) => api.getQuote(symbol))
      );

      const ok = settled
        .filter(
          (r): r is PromiseFulfilledResult<Quote> => r.status === 'fulfilled' && r.value
        )
        .map(r => r.value);

      setQuotes(ok);
    } catch {
      setQuotes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load])
  );

  useFocusEffect(
    React.useCallback(() => {
      marketSocket.connect();
      const unsubState = marketSocket.onStateChange(setConnection);
      return () => {
        unsubState();
      };
    }, [])
  );

  const removeSymbol = (symbol: string) => {
    Alert.alert('Listeden kaldir', `${symbol.replace('.IS', '')} takip listesinden cikarilsin mi?`, [
      { text: 'Vazgec', style: 'cancel' },
      {
        text: 'Kaldir',
        style: 'destructive',
        onPress: async () => {
          await api.removeFromWatchlist(symbol);
          setQuotes(prev => prev.filter(q => q.symbol !== symbol));
        },
      },
    ]);
  };

  const stats = useMemo(() => {
    if (quotes.length === 0) return null;
    const up = quotes.filter(q => (q.changePercent || 0) > 0).length;
    const down = quotes.filter(q => (q.changePercent || 0) < 0).length;
    const avg = quotes.reduce((s, q) => s + (q.changePercent || 0), 0) / quotes.length;
    const best = [...quotes].sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0))[0];
    return { up, down, avg, best };
  }, [quotes]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Takip listesi yukleniyor</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Takip Listem</Text>
            <View style={styles.connectionRow}>
              <View
                style={[
                  styles.dot,
                  connection === 'connected' && styles.dotLive,
                ]}
              />
              <Text style={styles.connectionText}>
                {quotes.length} hisse ·{' '}
                {connection === 'connected' ? 'canlı' : 'bağlanıyor'}
              </Text>
            </View>
          </View>
          <Pressable onPress={() => load(true)} style={styles.refreshBtn}>
            <Text style={styles.refreshIcon}>↻</Text>
          </Pressable>
        </View>

        {stats && (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderColor: colors.greenBorder, backgroundColor: colors.greenSoft }]}>
              <Text style={[styles.statValue, { color: colors.green }]}>{stats.up}</Text>
              <Text style={styles.statLabel}>yukselen</Text>
            </View>
            <View style={[styles.statCard, { borderColor: colors.redBorder, backgroundColor: colors.redSoft }]}>
              <Text style={[styles.statValue, { color: colors.red }]}>{stats.down}</Text>
              <Text style={styles.statLabel}>dusen</Text>
            </View>
            <View style={[styles.statCard, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
              <Text
                style={[
                  styles.statValue,
                  { color: stats.avg >= 0 ? colors.green : colors.red },
                ]}
              >
                {stats.avg >= 0 ? '+' : ''}{stats.avg.toFixed(1)}%
              </Text>
              <Text style={styles.statLabel}>ortalama</Text>
            </View>
            {stats.best && (
              <View style={[styles.statCard, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
                <Text style={[styles.statValue, { color: colors.accent, fontSize: 15 }]}>
                  {stats.best.symbol.replace('.IS', '')}
                </Text>
                <Text style={styles.statLabel}>en iyi</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <FlatList
        data={quotes}
        keyExtractor={i => i.symbol}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <WatchCard
            item={item}
            index={index}
            onPress={() => router.push(`/detail/${item.symbol}`)}
            onRemove={() => removeSymbol(item.symbol)}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="★"
            title="Takip listesi bos"
            message="Hisseler sekmesinden yildiza dokunarak istedigin hisseleri takip listesine ekle"
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { ...typography.caption, color: colors.textTertiary, marginTop: 12 },

  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: { ...typography.title, color: colors.textPrimary },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textTertiary },
  dotLive: { backgroundColor: colors.green },
  connectionText: { ...typography.caption, color: colors.textSecondary },

  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  refreshIcon: { color: colors.accent, fontSize: 18, fontWeight: '700' },

  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 10, color: colors.textTertiary, marginTop: 2 },

  list: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  cardPressed: {
    backgroundColor: colors.surfaceHover,
    transform: [{ scale: 0.985 }],
  },
  cardGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.accent,
    opacity: 0.4,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardLeft: { flex: 1 },
  symbol: { ...typography.heading, color: colors.textPrimary },
  name: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },
  removeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.redSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeIcon: { color: colors.red, fontSize: 18, fontWeight: '700', lineHeight: 20 },

  cardBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  price: { ...typography.title },
  tryLabel: { fontSize: 11, color: colors.textTertiary, marginTop: -2 },
});


