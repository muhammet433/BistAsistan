const https = require('https');

class BISTDataFetcher {
    constructor() {

        this.symbols = [
            'A1CAP', 'AAGYO', 'ADEL', 'ADESE', 'ADGYO', 'AEFES',
            'AFYON', 'AGESA', 'AGHOL', 'AGROT', 'AGYO', 'AHGAZ',
            'AHSGY', 'AKBNK', 'AKCNS', 'AKENR', 'AKFGY', 'AKFIS',
            'AKFYE', 'AKGRT', 'AKHAN', 'AKMGY', 'AKSA', 'AKSEN',
            'AKSGY', 'ALARK', 'ALBRK', 'ALBTN', 'ALCAR', 'ALCTL',
            'ALFAS', 'ALGYO', 'ALKA', 'ALKIM', 'ALKLC', 'ALTNY',
            'ANELE', 'ANGEN', 'ANHYT', 'ANSGR', 'ARASE', 'ARCLK',
            'ARDYZ', 'ARFYE', 'ARMGD', 'ARSAN', 'ARTMS', 'ASELS',
            'ASGYO', 'ASTOR', 'ASUZU', 'ATAKP', 'ATATP', 'ATATR',
            'ATEKS', 'AVGYO', 'AVPGY', 'AYCES', 'AYDEM', 'AYEN',
            'AYES', 'AYGAZ', 'AZTEK', 'BAGFS', 'BAHKM', 'BAKAB',
            'BALSU', 'BANVT', 'BARMA', 'BASCM', 'BASGZ', 'BEGYO',
            'BERA', 'BESLR', 'BESTE', 'BETAE', 'BEYAZ', 'BFREN',
            'BIENY', 'BIGCH', 'BIGEN', 'BIGTK', 'BIMAS', 'BINBN',
            'BINHO', 'BIOEN', 'BJKAS', 'BKRGY', 'BLCYT', 'BLUME',
            'BMSTL', 'BOBET', 'BORSK', 'BOSSA', 'BRISA', 'BRKVY',
            'BRLSM', 'BRSAN', 'BRYAT', 'BSOKE', 'BTCIM', 'BUCIM',
            'BULGS', 'BURCE', 'BURVA', 'BVSAN', 'BYDNR', 'CANTE',
            'CATES', 'CCOLA', 'CELHA', 'CEMAS', 'CEMTS', 'CEMZY',
            'CGCAM', 'CIMSA', 'CITAS', 'CLEBI', 'CMBTN', 'CMENT',
            'CRDFA', 'CRFSA', 'CUSAN', 'CVKMD', 'CWENE', 'DAGI',
            'DAPGM', 'DARDL', 'DERHL', 'DESA', 'DEVA', 'DGATE',
            'DGGYO', 'DMRGD', 'DNISI', 'DOAS', 'DOCO', 'DOFRB',
            'DOHOL', 'DOKTA', 'DSTKF', 'DURDO', 'DYOBY', 'DZGYO',
            'EBEBK', 'ECILC', 'ECOGR', 'ECZYT', 'EDATA', 'EDIP',
            'EFOR', 'EGEEN', 'EGEGY', 'EGEPO', 'EGGUB', 'EGPRO',
            'EGSER', 'EKDMR', 'EKGYO', 'EKIM', 'EKOS', 'EKSUN',
            'ELITE', 'EMPAE', 'ENDAE', 'ENERY', 'ENJSA', 'ENKAI',
            'ENPRA', 'ENSRI', 'ENTRA', 'ERBOS', 'ERCB', 'EREGL',
            'ESCAR', 'ESCOM', 'ESEN', 'ETILR', 'EUPWR', 'EUREN',
            'FENER', 'FMIZP', 'FONET', 'FORTE', 'FRIGO', 'FRMPL',
            'FROTO', 'FZLGY', 'GARAN', 'GARFA', 'GATEG', 'GEDIK',
            'GENIL', 'GENKM', 'GENTS', 'GEREL', 'GESAN', 'GIPTA',
            'GLCVY', 'GLRMK', 'GLYHO', 'GMTAS', 'GOKNR', 'GOLDA',
            'GOLTS', 'GOODY', 'GOZDE', 'GRSEL', 'GRTHO', 'GSDDE',
            'GSDHO', 'GSRAY', 'GUBRF', 'GUNDG', 'GWIND', 'GZNMI',
            'HALKB', 'HATSN', 'HDFGS', 'HEDEF', 'HEKTS', 'HLGYO',
            'HOROZ', 'HRKET', 'HTTBT', 'HUNER', 'HURGZ', 'ICBCT',
            'IEYHO', 'IHAAS', 'INDES', 'INFO', 'INGRM', 'INTEK',
            'INTEM', 'INTET', 'INVEO', 'INVES', 'ISBIR', 'ISBTR',
            'ISCTR', 'ISDMR', 'ISFIN', 'ISGSY', 'ISGYO', 'ISKPL',
            'ISKUR', 'ISMEN', 'ISSEN', 'ISVEA', 'IZENR', 'IZFAS',
            'IZMDC', 'JANTS', 'KAPLM', 'KARCL', 'KAREL', 'KARSN',
            'KARTN', 'KATMR', 'KAYSE', 'KBORU', 'KCAER', 'KCHOL',
            'KENT', 'KERVN', 'KGYO', 'KIMMR', 'KLGYO', 'KLKIM',
            'KLMSN', 'KLNMA', 'KLRHO', 'KLSER', 'KLSYN', 'KLYPV',
            'KMPUR', 'KNFRT', 'KOCMT', 'KONKA', 'KONTR', 'KONYA',
            'KOPOL', 'KORDS', 'KOTON', 'KPEKS', 'KRDMA', 'KRDMB',
            'KRDMD', 'KRGYO', 'KRONT', 'KRPLS', 'KRVGD', 'KSTUR',
            'KTLEV', 'KTSKR', 'KUTPO', 'KUVVA', 'KUYAS', 'KZBGY',
            'KZGYO', 'LIDER', 'LIDFA', 'LILAK', 'LINK', 'LKMNH',
            'LMKDC', 'LOGO', 'LUKSK', 'LXGYO', 'LYDHO', 'LYDYE',
            'MAALT', 'MACKO', 'MAGEN', 'MANAS', 'MARBL', 'MARMR',
            'MARTI', 'MASFN', 'MAVI', 'MCARD', 'MEDTR', 'MEGMT',
            'MEKAG', 'MEPET', 'MERCN', 'MERIT', 'METEN', 'METRO',
            'MEYSU', 'MGROS', 'MHRGY', 'MIATK', 'MNDRS', 'MNDTR',
            'MOBTL', 'MOGAN', 'MOPAS', 'MPARK', 'MRGYO', 'MRSHL',
            'MSGYO', 'MTRKS', 'NATEN', 'NETAS', 'NETCD', 'NETGL',
            'NTGAZ', 'NTHOL', 'NUGYO', 'NUHCM', 'OBAMS', 'ODAS',
            'ODINE', 'OFSYM', 'ONCSM', 'ONRYT', 'ORGE', 'ORMA',
            'ORZAX', 'OSMEN', 'OTKAR', 'OYAKC', 'OYYAT', 'OZATD',
            'OZKGY', 'OZSUB', 'OZYSR', 'PAGYO', 'PAHOL', 'PAPIL',
            'PARSN', 'PASEU', 'PATEK', 'PCILT', 'PEKGY', 'PENTA',
            'PETKM', 'PETUN', 'PGSUS', 'PINSU', 'PKART', 'PKENT',
            'PLTUR', 'PNLSN', 'PNSUT', 'POLHO', 'POLTK', 'PRKAB',
            'PRKME', 'PSGYO', 'QNBFK', 'QNBTR', 'QUAGR', 'QUICK',
            'RALYH', 'RAYSG', 'REEDR', 'RGYAS', 'RYGYO', 'RYSAS',
            'SAFKR', 'SAHOL', 'SANFM', 'SANKO', 'SARAE', 'SARKY',
            'SASA', 'SAYAS', 'SDTTR', 'SEGMN', 'SEGYO', 'SELEC',
            'SERNT', 'SISE', 'SKBNK', 'SKYMD', 'SMRTG', 'SMRVA',
            'SNGYO', 'SNPAM', 'SOHOE', 'SOKE', 'SOKM', 'SONME',
            'SRVGY', 'SSAAT', 'SUNTK', 'SURGY', 'SUWEN', 'SVGYO',
            'TABGD', 'TARKM', 'TATEN', 'TATGD', 'TAVHL', 'TBORG',
            'TCELL', 'TCKRC', 'TEHOL', 'TERA', 'TEZOL', 'TGSAS',
            'THYAO', 'TKFEN', 'TKNKA', 'TKNSA', 'TMSN', 'TNZTP',
            'TOASO', 'TRALT', 'TRCAS', 'TRENJ', 'TRGYO', 'TRHOL',
            'TRMET', 'TSGYO', 'TSKB', 'TSPOR', 'TTKOM', 'TTRAK',
            'TUKAS', 'TUPRS', 'TUREX', 'TURGG', 'TURSG', 'UCAYM',
            'UFUK', 'ULKER', 'ULUFA', 'ULUSE', 'ULUUN', 'UNLU',
            'VAKBN', 'VAKFA', 'VAKFN', 'VAKKO', 'VANGD', 'VBTYZ',
            'VERUS', 'VESBE', 'VESTL', 'VEYAS', 'VKGYO', 'VSNMD',
            'YAPRK', 'YATAS', 'YBTAS', 'YEOTK', 'YGGYO', 'YIGIT',
            'YKBNK', 'YUNSA', 'YYLGD', 'ZERGY', 'ZGYO', 'ZOREN',
            'ZRGYO',
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

normalizeSymbol(symbol) {
        const clean = symbol.toUpperCase().trim();
        return clean.endsWith('.IS') ? clean : `${clean}.IS`;
    }

    async fetchQuote(symbol) {
        try {
            const url = this.buildUrl(this.normalizeSymbol(symbol), 'interval=1d&range=1d');
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
            const url = this.buildUrl(this.normalizeSymbol(symbol), `interval=${interval}&range=${period}`);
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
        const symbols = this.symbols.map(s => this.normalizeSymbol(s));
        const results = [];
        const batchSize = 12;

        for (let i = 0; i < symbols.length; i += batchSize) {
            const batch = symbols.slice(i, i + batchSize);
            const settled = await Promise.all(batch.map(s => this.fetchQuote(s)));
            results.push(...settled.filter(Boolean));
            await new Promise(r => setTimeout(r, 150));
        }

        return results;
    }

    async fetchQuotesFor(symbols) {
        const normalized = symbols.map(s => this.normalizeSymbol(s));
        const results = [];
        const batchSize = 12;

        for (let i = 0; i < normalized.length; i += batchSize) {
            const batch = normalized.slice(i, i + batchSize);
            const settled = await Promise.all(batch.map(s => this.fetchQuote(s)));
            results.push(...settled.filter(Boolean));
            await new Promise(r => setTimeout(r, 150));
        }

        return results;
    }

    async fetchBatchQuotes(symbols) {
        return this.fetchQuotesFor(symbols);
    }
}

module.exports = new BISTDataFetcher();

