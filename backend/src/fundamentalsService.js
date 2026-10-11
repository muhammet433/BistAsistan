const https = require('https');

const BASE = 'https://bilancoveri.com/api/v1';

class FundamentalsService {
    constructor() {
        this.companies = null;
        this.fetchedAt = null;
        this.ttl = 12 * 60 * 60 * 1000;
        this.ratioMap = null;
    }

    fetchJSON(url) {
        return new Promise((resolve, reject) => {
            const req = https.get(url, { headers: { 'User-Agent': 'BISTAnaliz/1.0' } }, res => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    res.resume();
                    return this.fetchJSON(res.headers.location).then(resolve, reject);
                }
                if (res.statusCode !== 200) {
                    res.resume();
                    return reject(new Error(`HTTP ${res.statusCode}`));
                }
                let data = '';
                res.on('data', c => (data += c));
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); }
                    catch { reject(new Error('JSON parse hatasi')); }
                });
            });
            req.setTimeout(30000, () => { req.destroy(); reject(new Error('Zaman asimi')); });
            req.on('error', reject);
        });
    }

    async load() {
        if (this.companies && Date.now() - this.fetchedAt < this.ttl) {
            return this.companies;
        }

        const data = await this.fetchJSON(`${BASE}/sirketler.json`);
        const companies = data.companies || [];

        this.ratioMap = new Map();
        for (const c of companies) {
            this.ratioMap.set(c.ticker.toUpperCase(), c);
        }

        this.companies = companies;
        this.fetchedAt = Date.now();
        console.log(`[Fundamentals] ${companies.length} şirket yuklendi`);

        return companies;
    }

    async get(symbol) {
        await this.load();
        return this.ratioMap.get(symbol.replace('.IS', '').toUpperCase()) || null;
    }

    getFloatRatio(symbol) {
        if (!this.ratioMap) return null;
        const company = this.ratioMap.get(symbol.replace('.IS', '').toUpperCase());
        if (!company || typeof company.float_ratio !== 'number') return null;
        return company.float_ratio;
    }

    categorize(floatRatio) {
        if (floatRatio === null || floatRatio === undefined) {
            return { label: 'BILINMIYOR', tone: 'neutral', score: 50 };
        }

        if (floatRatio < 20) {
            return {
                label: 'KAYITLI SERMAYE',
                tone: 'red',
                score: 15,
                warning: 'Halka açıkta hisse oranı cok dusuk — fiyat manipülasyonu riski yuksek',
            };
        }
        if (floatRatio < 35) {
            return {
                label: 'DAHA DUSUK KATILIM',
                tone: 'amber',
                score: 38,
                warning: 'Katilim orani ideal seviyenin altinda — dikkatli ol',
            };
        }
        if (floatRatio < 50) {
            return {
                label: 'ORTA KATILIM',
                tone: 'amber',
                score: 62,
                warning: 'Katilim orani orta seviyede',
            };
        }
        if (floatRatio < 70) {
            return {
                label: 'IYI KATILIM',
                tone: 'green',
                score: 82,
                warning: null,
            };
        }

        return {
            label: 'YUKSEK KATILIM',
            tone: 'green',
            score: 95,
            warning: null,
        };
    }

    analyze(symbol) {
        const floatRatio = this.getFloatRatio(symbol);
        const category = this.categorize(floatRatio);

        return {
            floatRatio,
            ...category,
            isHealthy: category.tone === 'green',
            updatedAt: this.fetchedAt ? new Date(this.fetchedAt).toISOString() : null,
        };
    }

    getFundamentals(symbol) {
        if (!this.ratioMap) return null;
        const c = this.ratioMap.get(symbol.replace('.IS', '').toUpperCase());
        if (!c) return null;

        return {
            name: c.name,
            sector: c.sector,
            pe: c.pe,
            pb: c.pb,
            evEbitda: c.ev_ebitda,
            roe: c.roe,
            roa: c.roa,
            dividendYield: c.dividend_yield,
            marketCapMn: c.market_cap_mn_try,
            lastPeriod: c.last_period,
        };
    }
}

module.exports = new FundamentalsService();