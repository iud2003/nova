const fs = require('fs');
const path = 'C:\\Users\\isumd\\Documents\\My Projects\\new\\client\\src\\pages\\prediction\\PredictionPage.tsx';

let content = fs.readFileSync(path, 'utf8');

// 1. Add imports if not present
if (!content.includes('TradingChart')) {
  content = content.replace(
    "import api from '../../services/api';",
    "import { TradingChart, type CandleData } from '../../components/TradingChart';\nimport api from '../../services/api';"
  );
}

// 2. Add state and live BTC websocket logic
if (!content.includes('btcCandles')) {
  const btcCode = `
  // Live Real BTC Data Feed
  const [btcPrice, setBtcPrice] = useState<number>(0);
  const [btcCandles, setBtcCandles] = useState<CandleData[]>([]);
  const [btcChange24h, setBtcChange24h] = useState<number>(0);
  const [showChart, setShowChart] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=70')
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted || !Array.isArray(data)) return;
        const formatted: CandleData[] = data.map((d: any) => ({
          time: Math.floor(d[0] / 1000),
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4]),
        }));
        setBtcCandles(formatted);
        if (formatted.length > 0) {
          setBtcPrice(formatted[formatted.length - 1].close);
        }
      })
      .catch(console.error);

    fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT')
      .then((res) => res.json())
      .then((data) => {
        if (data?.priceChangePercent) setBtcChange24h(parseFloat(data.priceChangePercent));
      })
      .catch(console.error);

    const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_1m');
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.e === 'kline') {
          const k = msg.k;
          const currentClose = parseFloat(k.c);
          setBtcPrice(currentClose);
          const candleTime = Math.floor(k.t / 1000);
          const liveCandle: CandleData = {
            time: candleTime,
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: currentClose,
          };
          setBtcCandles((prev) => {
            if (prev.length === 0) return [liveCandle];
            const lastCandle = prev[prev.length - 1];
            if (lastCandle.time === candleTime) {
              const updated = [...prev];
              updated[updated.length - 1] = liveCandle;
              return updated;
            } else {
              return [...prev.slice(-99), liveCandle];
            }
          });
        }
      } catch (err) {}
    };

    return () => {
      isMounted = false;
      if (ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, []);
`;
  content = content.replace(
    'const [errorMsg, setErrorMsg] = useState<string | null>(null);',
    'const [errorMsg, setErrorMsg] = useState<string | null>(null);' + btcCode
  );
}

// 3. Insert live chart card before the countdown
if (!content.includes('LIVE BINANCE FEED')) {
  const chartHtml = `
            {/* Real Live BTC Candlestick Chart */}
            <div className="mb-6 rounded-2xl bg-card border border-border/80 overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 bg-background/60 border-b border-border/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-black text-amber-400 text-xs">
                    ₿
                  </div>
                  <div>
                    <span className="font-bold text-sm text-foreground">BTC / USDT</span>
                    <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      LIVE BINANCE FEED
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="font-mono font-extrabold text-base text-foreground">
                      \${btcPrice > 0 ? btcPrice.toLocaleString(undefined, { minimumFractionDigits: 2 }) : 'Loading...'}
                    </span>
                    <span className={\`ml-2 text-xs font-bold \${btcChange24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}\`}>
                      {btcChange24h >= 0 ? '+' : ''}{btcChange24h.toFixed(2)}%
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowChart(!showChart)}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                  >
                    {showChart ? 'Hide Chart' : 'Show Chart'}
                  </button>
                </div>
              </div>

              {showChart && (
                <div className="h-[360px] w-full relative bg-[#12141a]">
                  <TradingChart
                    candles={btcCandles}
                    currentPrice={btcPrice}
                    symbol="BTC/USDT"
                  />
                </div>
              )}
            </div>

`;
  content = content.replace('{/* Huge Countdown Display */}', chartHtml + '            {/* Huge Countdown Display */}');
}

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully injected chart into PredictionPage.tsx');
