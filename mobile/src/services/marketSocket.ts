import { WS_URL } from './config';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

export interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  dayHigh?: number;
  dayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

interface MarketMessage {
  type: string;
  payload: any;
  sentAt?: string;
}

type QuoteHandler = (quotes: Quote[]) => void;
type ChangeHandler = (changes: any[]) => void;
type StateHandler = (state: ConnectionState) => void;

class MarketSocket {
  private socket: WebSocket | null = null;
  private quoteHandlers: QuoteHandler[] = [];
  private changeHandlers: ChangeHandler[] = [];
  private stateHandlers: StateHandler[] = [];
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private manualClose = false;
  private lastQuotes: Quote[] = [];

  get state(): ConnectionState {
    if (!this.socket) return 'disconnected';
    if (this.socket.readyState === 0) return 'connecting';
    if (this.socket.readyState === 1) return 'connected';
    return 'disconnected';
  }

  connect(): void {
    if (this.socket && this.socket.readyState <= 1) return;

    this.manualClose = false;
    this.emitState('connecting');

    const socket = new WebSocket(WS_URL);
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.emitState('connected');
      this.startPing();
    };

    socket.onmessage = event => {
      try {
        const message: MarketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch {
        // Bozuk mesajları yoksay
      }
    };

    socket.onerror = () => {
      this.emitState('disconnected');
    };

    socket.onclose = () => {
      this.stopPing();
      this.emitState('disconnected');
      if (!this.manualClose) {
        this.scheduleReconnect();
      }
    };
  }

  disconnect(): void {
    this.manualClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPing();
    this.socket?.close();
    this.socket = null;
  }

  subscribe(symbols: string[]): void {
    this.send({ type: 'subscribe', symbols });
  }

  onQuotes(handler: QuoteHandler): () => void {
    this.quoteHandlers.push(handler);
    if (this.lastQuotes.length > 0) {
      handler(this.lastQuotes);
    }
    return () => {
      this.quoteHandlers = this.quoteHandlers.filter(h => h !== handler);
    };
  }

  onChanges(handler: ChangeHandler): () => void {
    this.changeHandlers.push(handler);
    return () => {
      this.changeHandlers = this.changeHandlers.filter(h => h !== handler);
    };
  }

  onStateChange(handler: StateHandler): () => void {
    this.stateHandlers.push(handler);
    handler(this.state);
    return () => {
      this.stateHandlers = this.stateHandlers.filter(h => h !== handler);
    };
  }

  private handleMessage(message: MarketMessage): void {
    if (message.type === 'connected' || message.type === 'quotes') {
      const quotes: Quote[] = message.payload?.quotes || [];
      if (quotes.length > 0) {
        this.lastQuotes = quotes;
        this.quoteHandlers.forEach(h => h(quotes));
      }
      return;
    }

    if (message.type === 'price_changes') {
      const changes = message.payload?.changes || [];
      this.changeHandlers.forEach(h => h(changes));
      return;
    }

    if (message.type === 'signal') {
      const { symbol, analysis } = message.payload || {};
      if (symbol && analysis) {
        this.lastQuotes = this.lastQuotes.map(q =>
          q.symbol === symbol ? { ...q, price: analysis.currentPrice ?? q.price } : q
        );
        this.quoteHandlers.forEach(h => h(this.lastQuotes));
      }
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts += 1;

    if (this.reconnectAttempts > 10) {
      return;
    }

    const delay = Math.min(1000 * 2 ** (this.reconnectAttempts - 1), 30000);

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => this.send({ type: 'ping' }), 25000);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private send(payload: object): void {
    if (this.socket?.readyState === 1) {
      this.socket.send(JSON.stringify(payload));
    }
  }

  private emitState(state: ConnectionState): void {
    this.stateHandlers.forEach(h => h(state));
  }
}

export const marketSocket = new MarketSocket();