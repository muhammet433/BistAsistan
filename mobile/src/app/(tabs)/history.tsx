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

interface NotificationItem {
  id: number;
  title: string;
  body: string;
  symbol: string | null;
  read: boolean;
  createdAt: string;
}

export default function NotificationHistoryScreen() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

      const data = await api.getNotifications();
      setItems(data.items || []);
      setUnread(data.unread || 0);

      if (data.unread > 0) {
        await api.markNotificationsRead();
        setUnread(0);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
      style={[styles.card, !item.read && styles.cardUnread]}
      onPress={() => item.symbol && router.push(`/detail/${item.symbol}`)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{item.title}</Text>
        {!item.read && <View style={styles.dot} />}
      </View>
      <Text style={styles.body}>{item.body}</Text>
      <Text style={styles.date}>{new Date(item.createdAt).toLocaleString('tr-TR')}</Text>
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
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread} okunmamış</Text>
        </View>
      )}
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Henüz bildirim yok</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  badge: {
    backgroundColor: '#4a90d9',
    margin: 12,
    marginBottom: 0,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  badgeText: { color: '#fff', fontWeight: '600', fontSize: 13 },
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
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cardUnread: {
    borderLeftColor: '#4a90d9',
    backgroundColor: '#f5f9ff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 14, fontWeight: '700', color: '#1a1a2e', flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4a90d9' },
  body: { color: '#555', fontSize: 13, marginTop: 6, lineHeight: 18 },
  date: { color: '#999', fontSize: 11, marginTop: 8 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#888', fontStyle: 'italic' },
});