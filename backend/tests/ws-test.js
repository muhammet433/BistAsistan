const WebSocket = require('ws');

const socket = new WebSocket('ws://localhost:3000/ws');
let got = 0;

socket.on('open', () => {
    console.log('WS baglandi');
    socket.send(JSON.stringify({ type: 'ping' }));
});

socket.on('message', raw => {
    const msg = JSON.parse(raw.toString());
    got++;
    if (msg.type === 'connected') {
        console.log(`connected: ${msg.payload.quotes?.length || 0} fiyat`);
    }
    if (msg.type === 'pong') console.log('pong OK');
});

socket.on('error', e => {
    console.error('HATA:', e.message);
    process.exit(1);
});

setTimeout(() => {
    console.log(`SONUC: ${got} mesaj alindi`);
    socket.close();
    process.exit(got >= 2 ? 0 : 1);
}, 6000);