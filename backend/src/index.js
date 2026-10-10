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
const db = require('./database');

notificationService.initialize();

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

realtime.attach(server);

app.use(cors());
app.use(express.json());

process.on('unhandledRejection', reason => {
    console.error('[HATA] Yakalanmamis hata:', reason?.message || reason);
});

process.on('uncaughtException', error => {
    console.error('[HATA] Yakalanmamis exception:', error.message);
});

async function requireAuth(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ success: false, error: 'Token gerekli' });
    }
    const userId = await authService.validateToken(token);
    if (!userId) {
        return res.status(401).json({ success: false, error: 'Gecersiz veya suresi dolmus token' });
    }
    req.userId = userId;
    req.token = token;
    next();
}

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', driver: db.kind, timestamp: new Date().toISOString() });
});

app.get('/api/quotes', async (req, res) => {
    const cached = await marketCache.getQuotes();

    if (cached.length > 0) {
        const age = await marketCache.getAgeMinutes();
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
        await marketCache.saveQuotes(quotes);
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

    const cached = await marketCache.getQuote(symbol);
    if (cached) {
        if (!(await marketCache.isFresh(symbol))) {
            marketPublisher.refreshQuotes().catch(() => {});
        }
        return res.json({ success: true, data: cached, meta: { cached: true } });
    }

    try {
        const quote = await dataFetcher.fetchQuote(symbol);
        if (!quote) {
            return res.status(404).json({ success: false, error: 'Hisse bulunamadi' });
        }
        await marketCache.saveQuotes([quote]);
        res.json({ success: true, data: quote, meta: { cached: false } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/historical/:symbol', async (req, res) => {
    try {
        const { period = '1y', interval = '1d' } = req.query;
        const data = await dataFetcher.fetchHistorical(
            req.params.symbol.toUpperCase(),
            period,
            interval
        );
        if (!data) {
            return res.status(404).json({ success: false, error: 'Veri bulunamadi' });
        }
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/analyze/:symbol', async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();

    try {
        const cached = await marketCache.getAnalysis(symbol, 30);
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

        await marketCache.saveAnalysis(symbol, payload);
        realtime.broadcastSignal(symbol, payload);

        res.json({ success: true, data: payload, meta: { cached: false } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/cache/status', async (req, res) => {
    res.json({
        success: true,
        data: {
            ...(await marketCache.getStats()),
            wsClients: realtime.getClientCount(),
        },
    });
});

app.post('/api/cache/refresh', async (req, res) => {
    const result = await marketPublisher.refreshQuotes();
    res.json({ success: true, data: result });
});

app.get('/api/scan', async (req, res) => {
    const quotes = await marketCache.getQuotes();
    const symbols = quotes.map(q => q.symbol);

    if (symbols.length === 0) {
        return res.status(503).json({ success: false, error: 'Fiyat verisi henuz yuklenmedi' });
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
        let quotes = await marketCache.getQuotes();
        if (quotes.length === 0) {
            quotes = await dataFetcher.fetchAllQuotes();
            await marketCache.saveQuotes(quotes);
        }

        const sorted = [...quotes].sort(
            (a, b) => (b.changePercent || 0) - (a.changePercent || 0)
        );

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

app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ success: false, error: 'Tum alanlar gerekli' });
    }
    res.json(await authService.register(name, email, password));
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'E-posta ve sifre gerekli' });
    }
    res.json(await authService.login(email, password));
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
    res.json(await authService.logout(req.token));
});

app.get('/api/user/profile', requireAuth, async (req, res) => {
    const user = await authService.getUser(req.userId);
    if (!user) {
        return res.status(404).json({ success: false, error: 'Kullanici bulunamadi' });
    }
    res.json({ success: true, data: user });
});

app.put('/api/user/preferences', requireAuth, async (req, res) => {
    res.json(await authService.updatePreferences(req.userId, req.body));
});

app.post('/api/user/fcm-token', requireAuth, async (req, res) => {
    const { fcmToken } = req.body;
    if (!fcmToken) {
        return res.status(400).json({ success: false, error: 'fcmToken gerekli' });
    }
    const result = await authService.updateFCMToken(req.userId, fcmToken);
    if (result.success) {
        await notificationService.subscribe(req.userId, fcmToken);
    }
    res.json(result);
});

app.get('/api/watchlist', requireAuth, async (req, res) => {
    res.json({ success: true, data: await authService.getWatchlist(req.userId) });
});

app.post('/api/watchlist/add', requireAuth, async (req, res) => {
    const { symbol } = req.body;
    if (!symbol) {
        return res.status(400).json({ success: false, error: 'symbol gerekli' });
    }
    res.json(await authService.updateWatchlist(req.userId, symbol, 'add'));
});

app.post('/api/watchlist/remove', requireAuth, async (req, res) => {
    const { symbol } = req.body;
    if (!symbol) {
        return res.status(400).json({ success: false, error: 'symbol gerekli' });
    }
    res.json(await authService.updateWatchlist(req.userId, symbol, 'remove'));
});

app.get('/api/alerts', requireAuth, async (req, res) => {
    res.json({ success: true, data: await alertService.getForUser(req.userId) });
});

app.post('/api/alerts', requireAuth, async (req, res) => {
    const { symbol, condition } = req.body;
    if (!symbol || !condition) {
        return res.status(400).json({ success: false, error: 'symbol ve condition gerekli' });
    }
    res.json(await alertService.create(req.userId, symbol, condition));
});

app.delete('/api/alerts/:alertId', requireAuth, async (req, res) => {
    res.json(await alertService.remove(req.userId, req.params.alertId));
});

app.post('/api/alerts/:alertId/reactivate', requireAuth, async (req, res) => {
    res.json(await alertService.reactivate(req.userId, req.params.alertId));
});

app.get('/api/notifications', requireAuth, async (req, res) => {
    res.json({
        success: true,
        data: {
            items: await notificationHistory.getForUser(req.userId),
            unread: await notificationHistory.getUnreadCount(req.userId),
        },
    });
});

app.post('/api/notifications/read', requireAuth, async (req, res) => {
    res.json(await notificationHistory.markAllRead(req.userId));
});

app.delete('/api/notifications', requireAuth, async (req, res) => {
    res.json(await notificationHistory.clear(req.userId));
});

async function runAnalysisScan() {
    const subscriptions = notificationService.getSubscriptions();
    if (subscriptions.length === 0) return;

    console.log(`[CRON] ${subscriptions.length} abonelik taraniyor`);

    for (const sub of subscriptions) {
        const symbols = sub.preferences.symbols || [];
        if (symbols.length === 0) continue;

        for (const symbol of symbols) {
            try {
                const historical = await dataFetcher.fetchHistorical(symbol, '1y', '1d');
                if (!historical || historical.length < 30) continue;

                const analysis = analysisEngine.analyze(historical);
                const overall = analysisEngine.getOverallSignal(analysis.signals || []);

                if (
                    overall.action !== 'HOLD' &&
                    overall.confidence >= sub.preferences.minConfidence
                ) {
                    const title = `${symbol} - ${
                        overall.action === 'BUY' ? 'ALIS' : 'SATIS'
                    } sinyali`;
                    const body = `Guven %${overall.confidence.toFixed(0)} · Fiyat ${analysis.currentPrice?.toFixed(
                        2
                    )} · RSI ${analysis.indicators?.rsi?.toFixed(1)}`;

                    await notificationService.sendNotification(sub.userId, {
                        title,
                        body,
                        symbol,
                        type: 'SIGNAL',
                        confidence: overall.confidence,
                    });
                    await notificationHistory.add(sub.userId, title, body, symbol);
                }

                const triggered = await alertService.checkAlerts(
                    sub.userId,
                    symbol,
                    analysis
                );

                for (const alert of triggered) {
                    const metricLabel = alert.type === 'PRICE' ? 'Fiyat' : 'RSI';
                    const dirLabel =
                        alert.direction === 'ABOVE' ? 'ustune cikti' : 'altina indi';
                    const title = `${alert.symbol} alarm tetiklendi`;
                    const body = `${metricLabel} ${dirLabel} (esik ${
                        alert.threshold
                    }, mevcut ${Number(alert.value).toFixed(2)})`;

                    await notificationService.sendNotification(sub.userId, {
                        title,
                        body,
                        symbol: alert.symbol,
                        type: 'ALERT',
                        confidence: 100,
                    });
                    await notificationHistory.add(sub.userId, title, body, alert.symbol);
                }

                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (error) {
                console.error(`[CRON] ${symbol} hatasi:`, error.message);
            }
        }
    }
}

cron.schedule('*/15 * * * *', () => {
    runAnalysisScan().catch(error => console.error('[CRON] Tarama hatasi:', error.message));
});

server.listen(PORT, () => {
    console.log(`BIST Analiz API: http://localhost:${PORT}`);
    console.log(`WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`Veritabani: ${db.kind}`);
    console.log(`Saat: ${new Date().toLocaleString('tr-TR')}`);
});

async function bootstrap() {
    const { PORT: port } = process.env;
    console.log(`[Baslangic] Veritabani: ${db.kind}`);

    try {
        const stats = await marketCache.getStats();
        if (stats.quoteCount > 0) {
            console.log(`[Baslangic] ${stats.quoteCount} fiyat onbellekten yuklendi`);
        }
    } catch (error) {
        console.error('[Baslangic] Onbellek okunamadi:', error.message);
    }

    marketPublisher.start();
    console.log(`[Baslangic] Sunucu ${port || 3000} portunda hazir`);
}

bootstrap();