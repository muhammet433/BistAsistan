import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './config';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem('authToken');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function fetchJSON(endpoint: string) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}${endpoint}`, { headers });
  if (!response.ok) {
    throw new Error(`API hatası: ${response.status}`);
  }
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Bilinmeyen hata');
  }
  return result.data;
}

async function postJSON(endpoint: string, body?: object) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await getAuthHeaders()),
  };
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return response.json();
}

async function putJSON(endpoint: string, body: object) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await getAuthHeaders()),
  };
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });
  return response.json();
}

async function deleteJSON(endpoint: string) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'DELETE',
    headers,
  });
  return response.json();
}

export const api = {
  getQuotes: () => fetchJSON('/quotes'),
  getQuote: (symbol: string) => fetchJSON(`/quote/${symbol}`),
  getHistorical: (symbol: string, period = '1y', interval = '1d') =>
    fetchJSON(`/historical/${symbol}?period=${period}&interval=${interval}`),
  getAnalysis: (symbol: string) => fetchJSON(`/analyze/${symbol}`),
  getNews: (symbol?: string) => fetchJSON(symbol ? `/news?symbol=${symbol}` : '/news'),
  getMarketSummary: () => fetchJSON('/market-summary'),
  getParticipation: (symbol: string) => fetchJSON(`/participation/${symbol}`),
  getAllParticipation: () => fetchJSON('/participation'),
  getTopPicks: async (filter = 'top', limit = 25) => {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE_URL}/top-picks?filter=${filter}&limit=${limit}`,
      { headers }
    );
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Hata');
    return result;
  },
  runScan: () => postJSON('/scan'),

  login: (email: string, password: string) => postJSON('/auth/login', { email, password }),
  register: (name: string, email: string, password: string) =>
    postJSON('/auth/register', { name, email, password }),
  logout: () => postJSON('/auth/logout'),
  getProfile: () => fetchJSON('/user/profile'),
  updatePreferences: (preferences: object) => putJSON('/user/preferences', preferences),
  updateFCMToken: (fcmToken: string) => postJSON('/user/fcm-token', { fcmToken }),

  getWatchlist: () => fetchJSON('/watchlist'),
  addToWatchlist: (symbol: string) => postJSON('/watchlist/add', { symbol }),
  removeFromWatchlist: (symbol: string) => postJSON('/watchlist/remove', { symbol }),

  getAlerts: () => fetchJSON('/alerts'),
  createAlert: (symbol: string, condition: object) => postJSON('/alerts', { symbol, condition }),
  deleteAlert: (alertId: string) => deleteJSON(`/alerts/${alertId}`),
  reactivateAlert: (alertId: string) => postJSON(`/alerts/${alertId}/reactivate`),

  getNotifications: () => fetchJSON('/notifications'),
  markNotificationsRead: () => postJSON('/notifications/read'),
  clearNotifications: () => deleteJSON('/notifications'),
};
