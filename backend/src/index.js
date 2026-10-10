require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const dataFetcher = require('./dataFetcher');
const analysisEngine = require('./analysisEngine');
const notificationService = require('./notificationService');
const authService = require('./authService');
const alertService = require('./alertService');
const newsService = require('./newsService');
const notificationHistory = require('./notificationHistoryService');
const marketCache = require('./marketCacheService');
const marketPublisher = require('./marketPublisher');
const realtime = require('./realtimeServer');

notificationService.initialize();

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

realtime.attach(server);

app.use(cors());
app.use(express.json());

process.on('unhandledRejection', (reason) => {
    console.error('[HATA] Yakalanmamasiş hata:', reason?.message || reason);
});

process.on('uncaughtException', (error) => {
    console.error('[HATA] Yakalanmamasiş exception:', error.message);
});

function requireAuth(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ success: false, error: 'Token gerekli' });
    }
    const userId = authService.validateToken(token);
    if (!userId) {
        return res.status(401).json({ success: false, error: 'Geçersiz veya süresi dolmuş token' });
    }
    req.userId = userId;
    req.token = token;
    next();
}

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/quotes', async (req, res) => {
    const cached = marketCache.getQuotes();

    if (cached.length > 0) {
        const age = marketCache.getAgeMinutes();
        if (age === null || age <= 5) {
            return res.json({
                success: true,
                data: cached,
                meta: { cached: true, ageMinutes: age },
            });
        }
    }

    try {
        const quotes = await dataFetcher.fetchAllQuotes();
        marketCache.saveQuotes(quotes);
        realtime.broadcastQuotes(quotes);
        res.json({ success: true, data: quotes, meta: { cached: false } });
    } catch (error) {
        if (cached.length > 0) {
            return res.json({
                success: true,
                data: cached,
                meta: { cached: true, stale: true, error: error.message },
            });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/quote/:symbol', async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();

    if (!marketCache.isFresh(symbol)) {
        marketPublisher.refreshQuotes().catch(() => {});
    }

    const cached = marketCache.getQuote(symbol);
    if (cached) {
        return res.json({ success: true, data: cached, meta: { cached: true } });
    }

    try {
        const quote = await dataFetcher.fetchQuote(symbol);
        if (!quote) {
            return res.status(404).json({ success: false, error: 'Hisse bulunamadı' });
        }
        marketCache.saveQuotes([quote]);
        res.json({ success: true, data: quote, meta: { cached: false } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/historical/:symbol', async (req, res) => {
    try {
        const { period = '1y', interval = '1d' } = req.query;
        const data = await dataFetcher.fetchHistorical(req.params.symbol.toUpperCase(), period, interval);
        if (!data) {
            return res.status(404).json({ success: false, error: 'Veri bulunamadı' });
        }
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/analyze/:symbol', async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();

    try {
        const cached = marketCache.getAnalysis(symbol, 30);
        if (cached) {
            return res.json({ success: true, data: cached, meta: { cached: true } });
        }

        const historical = await dataFetcher.fetchHistorical(symbol, '1y', '1d');
        if (!historical || historical.length < 30) {
            return res.status(404).json({ success: false, error: 'Yetersiz veri' });
        }

        const analysis = analysisEngine.analyze(historical);
        const overall = analysisEngine.getOverallSignal(analysis.signals || []);
        const payload = { ...analysis, overall };

        marketCache.saveAnalysis(symbol, payload);
        realtime.broadcastSignal(symbol, payload);

        res.json({ success: true, data: payload, meta: { cached: false } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/cache/status', (req, res) => {
    res.json({
        success: true,
        data: {
            ...marketCache.getStats(),
            wsClients: realtime.getClientCount(),
        },
    });
});

app.post('/api/cache/refresh', async (req, res) => {
    const result = await marketPublisher.refreshQuotes();
    res.json({ success: true, data: result });
});

app.get('/api/scan', async (req, res) => {
    const symbols = marketCache.getQuotes().map(q => q.symbol);
    if (symbols.length === 0) {
        return res.status(503).json({ success: false, error: 'Fiyat verisi henüz yüklenmedi' });
    }

    const results = await marketPublisher.analyzeSymbols(symbols);
    const rows = Object.entries(results).map(([symbol, analysis]) => ({
        symbol,
        price: analysis.currentPrice,
        action: analysis.overall.action,
        confidence: Math.round(analysis.overall.confidence),
        rsi: analysis.indicators?.rsi,
    }));

    rows.sort((a, b) => b.confidence - a.confidence);
    res.json({ success: true, data: rows, meta: { scanned: symbols.length } });
});

app.get('/api/news', async (req, res) => {
    try {
        const { symbol } = req.query;
        const data = await newsService.getNews(symbol ? symbol.toUpperCase() : null);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/market-summary', async (req, res) => {
    try {
        let quotes = marketCache.getQuotes();
        if (quotes.length === 0) {
            quotes = await dataFetcher.fetchAllQuotes();
            marketCache.saveQuotes(quotes);
        }

        const sorted = [...quotes].sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0));
        res.json({
            success: true,
            data: {
                topGainers: sorted.slice(0, 5),
                topLosers: sorted.slice(-5).reverse(),
                total: quotes.length,
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/auth/register', (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ success: false, error: 'Tüm alanlar gerekli' });
    }
    res.json(authService.register(name, email, password));
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'E-posta ve şifre gerekli' });
    }
    res.json(authService.login(email, password));
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
    res.json(authService.logout(req.token));
});

app.get('/api/user/profile', requireAuth, (req, res) => {
    const user = authService.getUser(req.userId);
    if (!user) {
        return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
    }
    res.json({ success: true, data: user });
});

app.put('/api/user/preferences', requireAuth, (req, res) => {
    res.json(authService.updatePreferences(req.userId, req.body));
});

app.post('/api/user/fcm-token', requireAuth, (req, res) => {
    const { fcmToken } = req.body;
    if (!fcmToken) {
        return res.status(400).json({ success: false, error: 'fcmToken gerekli' });
    }
    const result = authService.updateFCMToken(req.userId, fcmToken);
    if (result.success) {
        notificationService.subscribe(req.userId, fcmToken);
    }
    res.json(result);
});

app.get('/api/watchlist', requireAuth, (req, res) => {
    res.json({ success: true, data: authService.getWatchlist(req.userId) });
});

app.post('/api/watchlist/add', requireAuth, (req, res) => {
    const { symbol } = req.body;
    if (!symbol) {
        return res.status(400).json({ success: false, error: 'symbol gerekli' });
    }
    res.json(authService.updateWatchlist(req.userId, symbol, 'add'));
});

app.post('/api/watchlist/remove', requireAuth, (req, res) => {
    const { symbol } = req.body;
    if (!symbol) {
        return res.status(400).json({ success: false, error: 'symbol gerekli' });
    }
    res.json(authService.updateWatchlist(req.userId, symbol, 'remove'));
});

app.get('/api/alerts', requireAuth, (req, res) => {
    res.json({ success: true, data: alertService.getForUser(req.userId) });
});

app.post('/api/alerts', requireAuth, (req, res) => {
    const { symbol, condition } = req.body;
    if (!symbol || !condition) {
        return res.status(400).json({ success: false, error: 'symbol ve condition gerekli' });
    }
    res.json(alertService.create(req.userId, symbol, condition));
});

app.delete('/api/alerts/:alertId', requireAuth, (req, res) => {
    res.json(alertService.remove(req.userId, req.params.alertId));
});

app.post('/api/alerts/:alertId/reactivate', requireAuth, (req, res) => {
    res.json(alertService.reactivate(req.userId, req.params.alertId));
});

app.get('/api/notifications', requireAuth, (req, res) => {
    res.json({
        success: true,
        data: {
            items: notificationHistory.getForUser(req.userId),
            unread: notificationHistory.getUnreadCount(req.userId),
        },
    });
});

app.post('/api/notifications/read', requireAuth, (req, res) => {
    res.json(notificationHistory.markAllRead(req.userId));
});

app.delete('/api/notifications', requireAuth, (req, res) => {
    res.json(notificationHistory.clear(req.userId));
});

async function runAnalysisScan() {
    const subscriptions = notificationService.getSubscriptions();
    if (subscriptions.length === 0) return;

    console.log(`[CRON] ${subscriptions.length} abonelik taranıyor`);

    for (const sub of subscriptions) {
        const symbols = sub.preferences.symbols || [];
        if (symbols.length === 0) continue;

        for (const symbol of symbols) {
            try {
                const historical = await dataFetcher.fetchHistorical(symbol, '1y', '1d');
                if (!historical || historical.length < 30) continue;

                const analysis = analysisEngine.analyze(historical);
                const overall = analysisEngine.getOverallSignal(analysis.signals || []);

                if (overall.action !== 'HOLD' && overall.confidence >= sub.preferences.minConfidence) {
                    const title = `${symbol} - ${overall.action === 'BUY' ? 'ALIŞ' : 'SATIŞ'} sinyali`;
                    const body = `Güven %${overall.confidence.toFixed(0)} · Fiyat ${analysis.currentPrice?.toFixed(2)} · RSI ${analysis.indicators?.rsi?.toFixed(1)}`;

                    await notificationService.sendNotification(sub.userId, {
                        title,
                        body,
                        symbol,
                        type: 'SIGNAL',
                        confidence: overall.confidence,
                    });
                    notificationHistory.add(sub.userId, title, body, symbol);
                }

                const triggered = alertService.checkAlerts(sub.userId, symbol, analysis);
                for (const alert of triggered) {
                    const metricLabel = alert.type === 'PRICE' ? 'Fiyat' : 'RSI';
                    const dirLabel = alert.direction === 'ABOVE' ? 'üstüne çıktı' : 'altına indi';
                    const title = `${alert.symbol} alarm tetiklendi`;
                    const body = `${metricLabel} ${dirLabel} (eşik ${alert.threshold}, mevcut ${Number(alert.value).toFixed(2)})`;

                    await notificationService.sendNotification(sub.userId, {
                        title,
                        body,
                        symbol: alert.symbol,
                        type: 'ALERT',
                        confidence: 100,
                    });
                    notificationHistory.add(sub.userId, title, body, alert.symbol);
                }

                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (error) {
                console.error(`[CRON] ${symbol} hatası:`, error.message);
            }
        }
    }
}

cron.schedule('*/15 * * * *', () => {
    runAnalysisScan().catch(error => console.error('[CRON] Tarama hatası:', error.message));
});

server.listen(PORT, () => {
    console.log(`BIST Analiz API: http://localhost:${PORT}`);
    console.log(`WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`Saat: ${new Date().toLocaleString('tr-TR')}`);
});

const cached = marketCache.getQuotes();
if (cached.length > 0) {
    console.log(`[Baslangic] ${cached.length} fiyat onbellekten yuklendi`);
} else {
    marketPublisher.refreshQuotes().catch(err =>
        console.error('[Baslangic] Ilk veri yuklemesi basarisiz:', err.message)
    );
}

marketPublisher.start();