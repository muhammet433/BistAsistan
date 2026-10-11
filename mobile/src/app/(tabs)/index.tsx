import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TextInput,
  Pressable,
  Animated,
  ActivityIndicator,
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
} from '../../components/ui';

const SORT_OPTIONS = [
  { key: 'change', label: 'Değişim' },
  { key: 'volume', label: 'Hacim' },
  { key: 'symbol', label: 'A-Z' },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]['key'];

function StockCard({
  item,
  onPress,
  onToggleWatch,
  isWatched,
}: {
  item: Quote;
  onPress: () => void;
  onToggleWatch: () => void;
  isWatched: boolean;
}) {
    const opacity = useMemo(() => new Animated.Value(0), []);
    const translateY = useMemo(() => new Animated.Value(12), []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  const positive = (item.changePercent || 0) >= 0;

  const sparkData = useMemo(() => {
    const base = item.price || 1;
    const change = (item.changePercent || 0) / 100;
    return Array.from({ length: 12 }, (_, i) => {
      const t = i / 11;
      const trend = base * (1 - change + change * t);
      const noise = base * 0.004 * Math.sin(i * 2.3);
      return trend + noise;
    });
  }, [item.price, item.changePercent]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={styles.cardLeft}>
          <View style={styles.symbolRow}>
            <Text style={styles.symbol}>{item.symbol.replace('.IS', '')}</Text>
            {isWatched && <View style={styles.watchedDot} />}
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {item.name || '—'}
          </Text>
        </View>

        <Sparkline
          data={sparkData}
          width={54}
          height={26}
          color={positive ? colors.green : colors.red}
        />

        <View style={styles.cardRight}>
          <AnimatedNumber
            value={item.price || 0}
            decimals={2}
            style={[
              styles.price,
              { color: positive ? colors.green : colors.red },
            ]}
          />
          <ChangeBadge value={item.changePercent || 0} size="sm" />
        </View>

        <Pressable onPress={onToggleWatch} hitSlop={10} style={styles.starBtn}>
          <Text style={[styles.starIcon, isWatched && styles.starActive]}>
            {isWatched ? '★' : '☆'}
          </Text>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('change');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const router = useRouter();

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await api.getQuotes();
      setQuotes(data);
      const token = await AsyncStorage.getItem('authToken');
      if (token) setWatchlist(await api.getWatchlist());
    } catch {
      setQuotes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      marketSocket.connect();
      load();

      const unsubQuotes = marketSocket.onQuotes(next => {
        setQuotes(next);
        setLoading(false);
      });
      const unsubState = marketSocket.onStateChange(setConnection);

      return () => {
        unsubQuotes();
        unsubState();
        marketSocket.disconnect();
      };
    }, [load])
  );

  const filtered = useMemo(() => {
    let result = quotes;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        i =>
          i.symbol.toLowerCase().includes(q) ||
          (i.name || '').toLowerCase().includes(q)
      );
    }
    const sorted = [...result];
    if (sortBy === 'change') sorted.sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0));
    else if (sortBy === 'volume') sorted.sort((a, b) => (b.volume || 0) - (a.volume || 0));
    else sorted.sort((a, b) => a.symbol.localeCompare(b.symbol));
    return sorted;
  }, [quotes, search, sortBy]);

  const stats = useMemo(() => {
    if (quotes.length === 0) return { up: 0, down: 0, avg: 0 };
    const up = quotes.filter(q => (q.changePercent || 0) > 0).length;
    const down = quotes.filter(q => (q.changePercent || 0) < 0).length;
    const avg = quotes.reduce((s, q) => s + (q.changePercent || 0), 0) / quotes.length;
    return { up, down, avg };
  }, [quotes]);

  const toggleWatch = async (symbol: string) => {
    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      router.push('/auth');
      return;
    }
    try {
      if (watchlist.includes(symbol)) {
        await api.removeFromWatchlist(symbol);
        setWatchlist(prev => prev.filter(s => s !== symbol));
      } else {
        await api.addToWatchlist(symbol);
        setWatchlist(prev => [...prev, symbol]);
      }
    } catch {
      // sessiz
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Piyasa verisi yükleniyor</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>BIST Analiz</Text>
            <View style={styles.connectionRow}>
              <View
                style={[
                  styles.dot,
                  connection === 'connected' && styles.dotLive,
                  connection === 'connecting' && styles.dotPending,
                ]}
              />
              <Text style={styles.connectionText}>
                {connection === 'connected'
                  ? 'Canlı'
                  : connection === 'connecting'
                    ? 'Bağlanıyor'
                    : 'Çevrimdışı'}
              </Text>
            </View>
          </View>
          <View style={styles.countBox}>
            <Text style={styles.countValue}>{quotes.length}</Text>
            <Text style={styles.countLabel}>hisse</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statChip, { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder }]}>
            <Text style={[styles.statText, { color: colors.green }]}>{stats.up} yükselen</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: colors.redSoft, borderColor: colors.redBorder }]}>
            <Text style={[styles.statText, { color: colors.red }]}>{stats.down} düşen</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: colors.blueSoft, borderColor: colors.blueBorder }]}>
            <Text style={[styles.statText, { color: colors.blue }]}>
              Ort. {stats.avg >= 0 ? '+' : ''}{stats.avg.toFixed(2)}%
            </Text>
          </View>
        </View>

        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Hisse ara — sembol veya şirket adı"
          placeholderTextColor={colors.textTertiary}
          autoCorrect={false}
        />

        <View style={styles.sortRow}>
          {SORT_OPTIONS.map(option => (
            <Pressable
              key={option.key}
              onPress={() => setSortBy(option.key)}
              style={[styles.sortBtn, sortBy === option.key && styles.sortBtnActive]}
            >
              <Text style={[styles.sortText, sortBy === option.key && styles.sortTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i.symbol}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <StockCard
            item={item}
            isWatched={watchlist.includes(item.symbol)}
            onPress={() => router.push(`/detail/${item.symbol}`)}
            onToggleWatch={() => toggleWatch(item.symbol)}
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
            icon="⌕"
            title={search ? 'Sonuç bulunamadı' : 'Veri yok'}
            message={search ? `Aramanla eşleşen hisse yok` : 'Bağlantıyı kontrol edip yenilemeyi dene'}
          />
        }
        initialNumToRender={12}
        windowSize={10}
        removeClippedSubviews
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 12,
  },

  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textTertiary,
  },
  dotLive: { backgroundColor: colors.green },
  dotPending: { backgroundColor: colors.amber },
  connectionText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  countBox: {
    alignItems: 'flex-end',
  },
  countValue: {
    ...typography.title,
    color: colors.accent,
  },
  countLabel: {
    ...typography.caption,
    color: colors.textTertiary,
  },

  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  statText: {
    fontSize: 11,
    fontWeight: '700',
  },

  search: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  sortRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  sortBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  sortBtnActive: { backgroundColor: colors.accent },
  sortText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  sortTextActive: { color: colors.textInverse },

  list: {
    padding: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardPressed: {
    backgroundColor: colors.surfaceHover,
    transform: [{ scale: 0.99 }],
  },
  cardLeft: { flex: 1, marginRight: spacing.sm },
  symbolRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  symbol: {
    ...typography.subheading,
    color: colors.textPrimary,
  },
  watchedDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.amber,
  },
  name: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
    minWidth: 78,
  },
  price: {
    ...typography.subheading,
    marginBottom: 4,
  },
  starBtn: {
    paddingLeft: spacing.md,
  },
  starIcon: {
    fontSize: 18,
    color: colors.textTertiary,
  },
  starActive: {
    color: colors.amber,
  },
});

