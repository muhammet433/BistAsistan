const db = require('./database');
const { toArg } = require('./database');

const STALE_MINUTES = 20;

class MarketCacheService {
    async saveQuotes(quotes) {
        if (!quotes || quotes.length === 0) return 0;

        const statements = quotes.map(q =>
            db.run(
                `INSERT INTO quotes (symbol, name, price, change, change_percent, volume,
                                    day_high, day_low, week52_high, week52_low, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                 ON CONFLICT(symbol) DO UPDATE SET
                    name = excluded.name,
                    price = excluded.price,
                    change = excluded.change,
                    change_percent = excluded.change_percent,
                    volume = excluded.volume,
                    day_high = excluded.day_high,
                    day_low = excluded.day_low,
                    week52_high = excluded.week52_high,
                    week52_low = excluded.week52_low,
                    updated_at = excluded.updated_at`,
                [
                    q.symbol, q.name, q.price, q.change, q.changePercent,
                    q.volume, q.dayHigh, q.dayLow, q.fiftyTwoWeekHigh, q.fiftyTwoWeekLow,
                ].map(toArg)
            )
        );

        await Promise.all(statements);
        return quotes.length;
    }

    async getQuotes() {
        const rows = await db.all('SELECT * FROM quotes ORDER BY symbol');
        return rows.map(row => ({
            symbol: row.symbol,
            name: row.name,
            price: row.price,
            change: row.change,
            changePercent: row.change_percent,
            volume: row.volume,
            dayHigh: row.day_high,
            dayLow: row.day_low,
            fiftyTwoWeekHigh: row.week52_high,
            fiftyTwoWeekLow: row.week52_low,
            updatedAt: row.updated_at,
        }));
    }

    async getQuote(symbol) {
        const row = await db.get('SELECT * FROM quotes WHERE symbol = ?', [
            toArg(symbol.toUpperCase()),
        ]);
        if (!row) return null;
        return {
            symbol: row.symbol,
            name: row.name,
            price: row.price,
            change: row.change,
            changePercent: row.change_percent,
            volume: row.volume,
            updatedAt: row.updated_at,
        };
    }

    async isFresh(symbol) {
        const row = await db.get(
            "SELECT symbol FROM quotes WHERE symbol = ? AND updated_at > datetime('now', ?)",
            [toArg(symbol.toUpperCase()), toArg(`-${STALE_MINUTES} minutes`)]
        );
        return Boolean(row);
    }

    async getAgeMinutes() {
        const row = await db.get(
            "SELECT CAST((julianday('now') - julianday(MAX(updated_at))) * 1440 AS INTEGER) AS age FROM quotes"
        );
        return row?.age ?? null;
    }

    async saveAnalysis(symbol, payload) {
        await db.run(
            `INSERT INTO analysis_cache (symbol, payload, computed_at)
             VALUES (?, ?, datetime('now'))
             ON CONFLICT(symbol) DO UPDATE SET
                payload = excluded.payload,
                computed_at = excluded.computed_at`,
            [toArg(symbol.toUpperCase()), toArg(JSON.stringify(payload))]
        );
    }

    async getAnalysis(symbol, maxAgeMinutes = 60) {
        const row = await db.get(
            `SELECT payload FROM analysis_cache
             WHERE symbol = ? AND computed_at > datetime('now', ?)`,
            [toArg(symbol.toUpperCase()), toArg(`-${maxAgeMinutes} minutes`)]
        );
        if (!row) return null;
        try {
            return JSON.parse(row.payload);
        } catch {
            return null;
        }
    }

    async getStats() {
        const quotes = await db.get('SELECT COUNT(*) AS c FROM quotes');
        const analyses = await db.get('SELECT COUNT(*) AS c FROM analysis_cache');
        return {
            driver: db.kind,
            quoteCount: quotes?.c ?? 0,
            analysisCount: analyses?.c ?? 0,
            ageMinutes: await this.getAgeMinutes(),
        };
    }
}

module.exports = new MarketCacheService();