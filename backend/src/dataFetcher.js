const https = require('https');

class BISTDataFetcher {
    constructor() {
        this.symbols = [
            'AKBNK.IS', 'GARAN.IS', 'ISCTR.IS', 'YKBNK.IS', 'VAKBN.IS',
            'HALKB.IS', 'ISFIN.IS', 'ISBTR.IS',
            'KCHOL.IS', 'SAHOL.IS',
            'SISE.IS', 'EREGL.IS', 'TUPRS.IS', 'PETKM.IS',
            'THYAO.IS', 'ASELS.IS', 'TCELL.IS', 'FROTO.IS', 'TMSN.IS',
            'NETAS.IS', 'KAREL.IS',
            'ENKAI.IS', 'AKENR.IS',
            'BIMAS.IS', 'ULKER.IS', 'VESTL.IS',
            'ARCLK.IS', 'AYDEM.IS', 'PGSUS.IS', 'TSKB.IS', 'AEFES.IS',
            'ISYAT.IS', 'SASA.IS',
        ];
        this.hostIndex = 0;
        this.hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
    }

    fetchJSON(url) {
        return new Promise((resolve, reject) => {
            const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    res.resume();
                    return this.fetchJSON(res.headers.location).then(resolve, reject);
                }
                if (res.statusCode !== 200) {
                    res.resume();
                    return reject(new Error(`HTTP ${res.statusCode}`));
                }
                let data = '';
                res.on('data', chunk => (data += chunk));
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch {
                        reject(new Error('JSON parse hatasi'));
                    }
                });
            });
            req.setTimeout(15000, () => {
                req.destroy();
                reject(new Error('Zaman asimi'));
            });
            req.on('error', reject);
        });
    }

    buildUrl(symbol, params) {
        const host = this.hosts[this.hostIndex % this.hosts.length];
        this.hostIndex += 1;
        return `https://${host}/v8/finance/chart/${symbol}?${params}`;
    }

    async fetchQuote(symbol) {
        try {
            const url = this.buildUrl(symbol, 'interval=1d&range=1d');
            const data = await this.fetchJSON(url);

            const result = data?.chart?.result?.[0];
            if (!result) throw new Error('Veri bulunamadi');

            const meta = result.meta;

            return {
                symbol: meta.symbol,
                price: meta.regularMarketPrice,
                change: meta.fulldayChange ?? meta.regularMarketChange,
                changePercent: meta.regularMarketChangePercent,
                volume: meta.regularMarketVolume,
                dayHigh: meta.regularMarketDayHigh,
                dayLow: meta.regularMarketDayLow,
                fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
                fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
                name: meta.longName || meta.shortName,
                currency: meta.currency,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return null;
        }
    }

    async fetchHistorical(symbol, period = '1y', interval = '1d') {
        try {
            const url = this.buildUrl(symbol, `interval=${interval}&range=${period}`);
            const data = await this.fetchJSON(url);

            const result = data?.chart?.result?.[0];
            if (!result) throw new Error('Veri bulunamadi');

            const timestamps = result.timestamp || [];
            const quote = result.indicators?.quote?.[0] || {};

            return timestamps
                .map((ts, i) => ({
                    date: new Date(ts * 1000).toISOString().split('T')[0],
                    open: quote.open?.[i],
                    high: quote.high?.[i],
                    low: quote.low?.[i],
                    close: quote.close?.[i],
                    volume: quote.volume?.[i],
                }))
                .filter(c => c.close != null);
        } catch (error) {
            return null;
        }
    }

    async fetchAllQuotes() {
        const quotes = [];
        for (const symbol of this.symbols) {
            const quote = await this.fetchQuote(symbol);
            if (quote) quotes.push(quote);
        }
        return quotes;
    }

    async fetchBatchQuotes(symbols) {
        const results = [];
        const batchSize = 8;

        for (let i = 0; i < symbols.length; i += batchSize) {
            const batch = symbols.slice(i, i + batchSize);
            const settled = await Promise.all(batch.map(s => this.fetchQuote(s)));
            results.push(...settled.filter(Boolean));
            await new Promise(r => setTimeout(r, 200));
        }

        return results;
    }
}

module.exports = new BISTDataFetcher();
