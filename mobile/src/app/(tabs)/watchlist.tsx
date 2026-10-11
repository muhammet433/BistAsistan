import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../services/api';

interface Quote {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
}

export default function WatchlistScreen() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const loadWatchlist = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const symbols = await api.getWatchlist();
      if (symbols.length === 0) {
        setQuotes([]);
        return;
      }

      const results = await Promise.all(
        symbols.map((symbol: string) => api.getQuote(symbol))
      );
      setQuotes(results.filter(Boolean));
    } catch {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        router.replace('/auth');
        return;
      }
      setError('Takip listesi yüklenemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      loadWatchlist();
    }, [loadWatchlist])
  );

  const removeSymbol = async (symbol: string) => {
    await api.removeFromWatchlist(symbol);
    setQuotes(prev => prev.filter(q => q.symbol !== symbol));
  };

  const renderItem = ({ item }: { item: Quote }) => {
    const isPositive = item.changePercent >= 0;
    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardMain}
          onPress={() => router.push(`/detail/${item.symbol}`)}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.symbol}>{item.symbol.replace('.IS', '')}</Text>
            <Text
              style={[styles.change, isPositive ? styles.positive : styles.negative]}
            >
              {isPositive ? '+' : ''}
              {item.changePercent?.toFixed(2)}%
            </Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.price}>{item.price?.toFixed(2)} ₺</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => removeSymbol(item.symbol)}
        >
          <Text style={styles.removeText}>Kaldır</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4a90d9" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={quotes}
        renderItem={renderItem}
        keyExtractor={item => item.symbol}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadWatchlist(true)}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Takip listeniz boş</Text>
            <Text style={styles.emptyText}>
              Ana ekrandan bir hisseye dokunup takip listesine ekleyebilirsiniz.
            </Text>
          </View>
        }
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  list: { padding: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardMain: { flex: 1, padding: 16 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  symbol: { fontSize: 18, fontWeight: 'bold', color: '#1a1a2e' },
  change: { fontSize: 14, fontWeight: '700' },
  positive: { color: '#4caf50' },
  negative: { color: '#f44336' },
  name: { color: '#666', marginTop: 4, fontSize: 14 },
  price: { fontSize: 20, fontWeight: 'bold', color: '#1a1a2e', marginTop: 8 },
  removeBtn: {
    paddingHorizontal: 16,
    height: '100%',
    justifyContent: 'center',
    backgroundColor: '#ffebee',
  },
  removeText: { color: '#d32f2f', fontWeight: '600', fontSize: 13 },
  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  emptyText: { color: '#888', textAlign: 'center', lineHeight: 20 },
  error: { color: '#d32f2f', textAlign: 'center', padding: 12 },
});

