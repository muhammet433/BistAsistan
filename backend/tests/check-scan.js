const db = require('../src/database');
const scanner = require('../src/scannerService');

(async () => {
    const rows = await db.all(
        'SELECT symbol, length(payload) as len, computed_at FROM analysis_cache'
    );
    console.log('analiz cache kayitlari:', rows.length);
    rows.forEach(r => console.log(`  ${r.symbol} | ${r.len} bayt | ${r.computed_at}`));

    const cached = await scanner.getCached();
    if (cached) {
        console.log('\nONBELLEK VAR:');
        console.log('  taranan:', cached.scanned);
        console.log('  sure:', Math.round((cached.durationMs || 0) / 1000) + 's');
        console.log('  bestTen:', cached.bestTen?.length);
    } else {
        console.log('\nONBELLEK YOK');
    }
})();
