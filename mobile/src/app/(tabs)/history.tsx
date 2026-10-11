import React, { useCallback, useState } from 'react';
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
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../services/api';
import { colors, spacing, radius, typography, shadows } from '../../theme';
import { EmptyState } from '../../components/ui';

interface NotificationItem {
  id: number;
  title: string;
  body: string;
  symbol: string | null;
  read: boolean;
  createdAt: string;
}

function HistoryCard({ item, index }: { item: NotificationItem; index: number }) {
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

  const isSignal = item.title.includes('sinyali');
  const isAlert = item.title.includes('alarm');
  const tone = isAlert
    ? { dot: colors.red, border: colors.redBorder }
    : isSignal
      ? { dot: colors.green, border: colors.greenBorder }
      : { dot: colors.accent, border: colors.blueBorder };

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <View style={[styles.card, !item.read && { borderLeftColor: tone.dot }]}>
        <View style={[styles.dot, { backgroundColor: tone.dot }]} />
        <View style={{ flex: 1 }}>
          <View style={styles.cardHeader}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            {!item.read && <View style={styles.unread} />}
          </View>
          <Text style={styles.body}>{item.body}</Text>
          <Text style={styles.date}>
            {new Date(item.createdAt).toLocaleString('tr-TR')}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

export default function HistoryScreen() {
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
    React.useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Geçmiş</Text>
            <Text style={styles.subtitle}>
              {items.length} bildirim
              {unread > 0 ? ` · ${unread} okunmamis` : ''}
            </Text>
          </View>
          <Pressable
            onPress={() => load(true)}
            style={styles.refreshBtn}
          >
            <Text style={styles.refreshIcon}>↻</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => item.symbol && router.push(`/detail/${item.symbol}`)}
          >
            <HistoryCard item={item} index={index} />
          </Pressable>
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
            icon="◷"
            title="Henuz bildirim yok"
            message="Alarm tetiklendiginde veya sinyal olustugunda burada gorunecek"
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  subtitle: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },
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

  list: { padding: spacing.md, paddingBottom: spacing.xxxl },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    ...shadows.card,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { ...typography.subheading, color: colors.textPrimary, flex: 1 },
  unread: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.accent },
  body: { ...typography.caption, color: colors.textSecondary, marginTop: 6, lineHeight: 18 },
  date: { fontSize: 10, color: colors.textTertiary, marginTop: 8 },
});