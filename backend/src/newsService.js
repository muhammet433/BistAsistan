const https = require('https');

class NewsService {
    constructor() {
        this.cache = new Map();
        this.cacheTTL = 15 * 60 * 1000;
        this.sources = [
            { name: 'Yahoo Finance', url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s={symbol}&region=TR&lang=tr-TR' },
        ];
    }

    fetchJSON(url) {
        return new Promise((resolve, reject) => {
            https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { reject(new Error('JSON parse hatası')); }
                });
            }).on('error', reject);
        });
    }

    fetchXML(url) {
        return new Promise((resolve, reject) => {
            https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject);
        });
    }

    parseRSS(xml) {
        const items = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;

        while ((match = itemRegex.exec(xml)) !== null) {
            const block = match[1];
            const title = this.extractTag(block, 'title');
            const link = this.extractTag(block, 'link');
            const pubDate = this.extractTag(block, 'pubDate');
            const description = this.stripHtml(this.extractTag(block, 'description'));

            if (title) {
                items.push({
                    title: this.stripHtml(title),
                    link,
                    pubDate,
                    summary: description.substring(0, 200),
                    source: 'Yahoo Finance',
                });
            }
        }

        return items;
    }

    extractTag(xml, tag) {
        const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
        const match = xml.match(regex);
        if (match) {
            return match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
        }
        const selfClosing = xml.match(new RegExp(`<${tag}[^>]*href="([^"]*)"`, 'i'));
        return selfClosing ? selfClosing[1] : null;
    }

    stripHtml(text) {
        if (!text) return '';
        return text
            .replace(/<[^>]*>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .trim();
    }

    async getNews(symbol = null) {
        const cacheKey = symbol || 'MARKET';
        const cached = this.cache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return { ...cached.data, cached: true };
        }

        try {
            const target = symbol
                ? this.sources[0].url.replace('{symbol}', `${symbol.replace('.IS', '')}.IS`)
                : 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=AKBNK.IS&region=TR&lang=tr-TR';

            const xml = await this.fetchXML(target);
            const news = this.parseRSS(xml);

            const result = {
                news: news.slice(0, 20),
                symbol: symbol || 'MARKET',
                timestamp: new Date().toISOString(),
            };

            this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;
        } catch (error) {
            console.error('[News] Hata:', error.message);
            const cached = this.cache.get(cacheKey);
            if (cached) return { ...cached.data, cached: true };
            return { news: [], symbol: symbol || 'MARKET', error: error.message };
        }
    }
}

module.exports = new NewsService();