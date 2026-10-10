const admin = require('firebase-admin');
const path = require('path');
const authService = require('./authService');

class NotificationService {
    constructor() {
        this.subscriptions = new Map();
        this.initialized = false;
    }

    initialize() {
        if (this.initialized) return;

        const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
            path.join(__dirname, '../../firebase-service-account.json');

        try {
            const serviceAccount = require(serviceAccountPath);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            this.initialized = true;
            console.log('[Firebase] Admin SDK başlatıldı');
        } catch (error) {
            console.warn('[Firebase] Service account yok, mock modda çalışıyor');
            this.initialized = false;
        }
    }

    async subscribe(userId, fcmToken) {
        const user = await authService.getUser(userId);
        const watchlist = user?.watchlist || [];

        this.subscriptions.set(userId, {
            fcmToken,
            preferences: {
                symbols: watchlist,
                minConfidence: user?.preferences?.minConfidence ?? 60,
            },
        });

        return { success: true, symbols: watchlist };
    }

    async syncFromWatchlist(userId) {
        if (!this.subscriptions.has(userId)) return;
        const watchlist = await authService.getWatchlist(userId);
        const sub = this.subscriptions.get(userId);
        sub.preferences.symbols = watchlist;
    }

    unsubscribe(userId) {
        this.subscriptions.delete(userId);
        return { success: true };
    }

    async sendNotification(userId, notification) {
        const subscription = this.subscriptions.get(userId);

        if (!subscription) {
            const stored = await authService.getFCMToken(userId);
            if (!stored) return { success: false, error: 'Abonelik yok' };
            this.subscribe(userId, stored);
        }

        const activeSub = this.subscriptions.get(userId);
        if (!activeSub) return { success: false, error: 'Abonelik yok' };

        if (!this.initialized) {
            console.log(`[MOCK] ${userId} → ${notification.title}`);
            return { success: true, mode: 'mock' };
        }

        try {
            const response = await admin.messaging().send({
                token: activeSub.fcmToken,
                notification: {
                    title: notification.title,
                    body: notification.body,
                },
                data: {
                    symbol: notification.symbol || '',
                    type: notification.type || '',
                },
                android: {
                    priority: 'high',
                    notification: { channelId: 'bist_alerts', sound: 'default' },
                },
                apns: { payload: { aps: { sound: 'default', badge: 1 } } },
            });

            return { success: true, messageId: response };
        } catch (error) {
            if (error.code === 'messaging/registration-token-not-registered') {
                this.subscriptions.delete(userId);
            }
            return { success: false, error: error.message };
        }
    }

    getSubscriptions() {
        return Array.from(this.subscriptions.entries()).map(([userId, data]) => ({
            userId,
            ...data,
        }));
    }
}

module.exports = new NotificationService();

