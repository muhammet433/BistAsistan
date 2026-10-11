import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { api } from '../../services/api';

interface NewsItem {
  title: string;
  link: string | null;
  pubDate: string;
  summary: string;
  source: string;
}

export default function NewsScreen() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNews = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await api.getNews();
      setNews(data.news || []);
    } catch {
      setNews([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  const renderItem = ({ item }: { item: NewsItem }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => item.link && Linking.openURL(item.link)}
      activeOpacity={0.7}
    >
      <Text style={styles.title}>{item.title}</Text>
      {item.summary ? <Text style={styles.summary}>{item.summary}</Text> : null}
      <View style={styles.metaRow}>
        <Text style={styles.source}>{item.source}</Text>
        {item.pubDate ? (
          <Text style={styles.date}>{new Date(item.pubDate).toLocaleDateString('tr-TR')}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

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
        data={news}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.title}-${index}`}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadNews(true)} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Haber bulunamadı</Text>
          </View>
        }
      />
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
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: { fontSize: 15, fontWeight: '600', color: '#1a1a2e', lineHeight: 21 },
  summary: { color: '#666', fontSize: 13, marginTop: 6, lineHeight: 18 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  source: { color: '#4a90d9', fontSize: 12, fontWeight: '600' },
  date: { color: '#888', fontSize: 12 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#888', fontStyle: 'italic' },
});