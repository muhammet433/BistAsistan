const cron = require('node-cron');
const dataFetcher = require('./dataFetcher');
const analysisEngine = require('./analysisEngine');
const marketCache = require('./marketCacheService');
const realtime = require('./realtimeServer');

class MarketPublisher {
    constructor() {
        this.isRefreshing = false;
    }

    async refreshQuotes() {
        if (this.isRefreshing) {
            return { skipped: true };
        }

        this.isRefreshing = true;
        const startedAt = Date.now();

        try {
            const quotes = await dataFetcher.fetchAllQuotes();
            const saved = marketCache.saveQuotes(quotes);

            const changed = await this.findChanged(quotes);
            const sent = realtime.broadcastQuotes(quotes);

            if (changed.length > 0) {
                realtime.broadcast('price_changes', { changes: changed });
            }

            console.log(
                `[Publisher] ${saved} fiyat kaydedildi, ${changed.length} degisim, ${sent} istemciye gonderildi (${Math.round((Date.now() - startedAt) / 1000)}s)`
            );

            return { saved, changes: changed.length, clients: sent };
        } catch (error) {
            console.error('[Publisher] Fiyat yenileme hatasi:', error.message);
            return { error: error.message };
        } finally {
            this.isRefreshing = false;
        }
    }

    async findChanged(quotes) {
        const changes = [];

        for (const quote of quotes) {
            const previous = await marketCache.getQuote(quote.symbol);
            if (!previous || previous.price === quote.price) continue;

            changes.push({
                symbol: quote.symbol,
                previousPrice: previous.price,
                price: quote.price,
                changePercent: quote.changePercent,
            });
        }

        return changes;
    }

    async analyzeSymbols(symbols) {
        const results = {};

        for (const symbol of symbols) {
            try {
                const cached = await marketCache.getAnalysis(symbol, 60);
                if (cached) {
                    results[symbol] = cached;
                    continue;
                }

                const historical = await dataFetcher.fetchHistorical(symbol, '1y', '1d');
                if (!historical || historical.length < 30) continue;

                const analysis = analysisEngine.analyze(historical);
                const overall = analysisEngine.getOverallSignal(analysis.signals || []);
                const payload = { ...analysis, overall };

                await marketCache.saveAnalysis(symbol, payload);
                results[symbol] = payload;
            } catch (error) {
                console.error(`[Publisher] ${symbol} analizi hatası:`, error.message);
            }
        }

        return results;
    }

start() {
        this.refreshQuotes().catch(() => {});

        cron.schedule('*/3 * * * * *', async () => {
            const stats = await marketCache.getStats();
            const age = stats.ageMinutes ?? 0;
            if (age >= 4) {
                this.refreshQuotes().catch(() => {});
            }
        });

        return this;
    }
}

module.exports = new MarketPublisher();
