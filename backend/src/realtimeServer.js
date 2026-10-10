const { WebSocketServer } = require('ws');

class RealtimeServer {
    constructor() {
        this.clients = new Set();
        this.lastQuotes = null;
        this.lastUpdateAt = null;
    }

    attach(httpServer) {
        this.wss = new WebSocketServer({ server: httpServer, path: '/ws' });

        this.wss.on('connection', (socket, request) => {
            const userId = new URL(request.url, 'http://localhost').searchParams.get('userId');

            this.clients.add(socket);
            console.log(`[WS] Bağlandı (${this.clients.size} aktif, user: ${userId || 'anonim'})`);

            socket.send(
                JSON.stringify({
                    type: 'connected',
                    payload: {
                        clients: this.clients.size,
                        quotes: this.lastQuotes,
                        updatedAt: this.lastUpdateAt,
                    },
                })
            );

            socket.on('message', raw => {
                let message;
                try {
                    message = JSON.parse(raw.toString());
                } catch {
                    return;
                }

                if (message.type === 'ping') {
                    socket.send(JSON.stringify({ type: 'pong', payload: { at: Date.now() } }));
                }

                if (message.type === 'subscribe' && Array.isArray(message.symbols)) {
                    socket.send(
                        JSON.stringify({
                            type: 'subscribed',
                            payload: { symbols: message.symbols },
                        })
                    );
                }
            });

            socket.on('close', () => {
                this.clients.delete(socket);
                console.log(`[WS] Ayrıldı (${this.clients.size} aktif)`);
            });

            socket.on('error', () => this.clients.delete(socket));
        });

        return this.wss;
    }

    broadcast(type, payload) {
        if (this.clients.size === 0) return 0;

        const message = JSON.stringify({
            type,
            payload,
            sentAt: new Date().toISOString(),
        });

        let sent = 0;
        for (const socket of this.clients) {
            if (socket.readyState === 1) {
                socket.send(message);
                sent++;
            }
        }
        return sent;
    }

    broadcastQuotes(quotes) {
        this.lastQuotes = quotes;
        this.lastUpdateAt = new Date().toISOString();
        return this.broadcast('quotes', { quotes, updatedAt: this.lastUpdateAt });
    }

    broadcastSignal(symbol, analysis) {
        return this.broadcast('signal', { symbol, analysis });
    }

    getClientCount() {
        return this.clients.size;
    }
}

module.exports = new RealtimeServer();