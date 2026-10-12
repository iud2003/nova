import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { TradingChart, type CandleData } from './components/TradingChart';
import { 
  TrendingUp, TrendingDown, RefreshCw, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:5000';

export function App() {
  const [selectedAsset, setSelectedAsset] = useState<'BTC' | 'NOVA'>('BTC');
  
  // Real BTC Market State
  const [btcPrice, setBtcPrice] = useState<number>(0);
  const [btcCandles, setBtcCandles] = useState<CandleData[]>([]);
  const [btcChange24h, setBtcChange24h] = useState<number>(0);
  const [btcRoundStrikePrice, setBtcRoundStrikePrice] = useState<number>(0);

  // Simulated NOVA Market State
  const [novaPrice, setNovaPrice] = useState<number>(1.0000);
  const [novaCandles, setNovaCandles] = useState<CandleData[]>([]);

  // Prediction Arena State
  const [activeRound, setActiveRound] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [betAmount, setBetAmount] = useState<number>(50);
  const [balance, setBalance] = useState<{ usdt: number; nova: number }>({ usdt: 2500, nova: 500 });
  const [predictions, setPredictions] = useState<any[]>([]);
  const [betStatus, setBetStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'trade' | 'packages' | 'wallet' | 'referrals'>('trade');

  const btcWsRef = useRef<WebSocket | null>(null);

  // 1. REAL LIVE BTC MARKET DATA VIA BINANCE WEBSOCKET & REST
  useEffect(() => {
    let isMounted = true;

    // Load initial 1m candles for BTC
    fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=80')
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted || !Array.isArray(data)) return;
        const formatted: CandleData[] = data.map((d: any) => ({
          time: Math.floor(d[0] / 1000) as any,
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4]),
        }));
        setBtcCandles(formatted);
        if (formatted.length > 0) {
          const lastClose = formatted[formatted.length - 1].close;
          setBtcPrice(lastClose);
          if (btcRoundStrikePrice === 0) setBtcRoundStrikePrice(lastClose);
        }
      })
      .catch((err) => console.error('Failed to load BTC historical candles:', err));

    // Load 24h ticker for change stats
    fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT')
      .then((res) => res.json())
      .then((data) => {
        if (data?.priceChangePercent) {
          setBtcChange24h(parseFloat(data.priceChangePercent));
        }
      })
      .catch(console.error);

    // Connect to live real-time Binance 1-minute kline stream
    const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_1m');
    btcWsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.e === 'kline') {
          const k = message.k;
          const currentClose = parseFloat(k.c);
          setBtcPrice(currentClose);

          const candleTime = Math.floor(k.t / 1000);
          const liveCandle: CandleData = {
            time: candleTime as any,
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: currentClose,
          };

          setBtcCandles((prev) => {
            if (prev.length === 0) return [liveCandle];
            const lastCandle = prev[prev.length - 1];

            if (lastCandle.time === candleTime) {
              // Update current live forming candle
              const updated = [...prev];
              updated[updated.length - 1] = liveCandle;
              return updated;
            } else {
              // New candle started
              return [...prev.slice(-99), liveCandle];
            }
          });
        }
      } catch (e) {
        console.error('Error parsing BTC stream:', e);
      }
    };

    ws.onerror = (err) => {
      console.warn('Binance WebSocket error, falling back to REST poll:', err);
    };

    return () => {
      isMounted = false;
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  // 2. NOVA INTERNAL SOCKET & ENGINE
  useEffect(() => {
    const socket: Socket = io(API_BASE, { path: '/socket.io' });

    socket.on('market:tick', (tick: any) => {
      if (tick?.price) {
        setNovaPrice(parseFloat(tick.price));
      }
    });

    socket.on('candle:complete', (candle: any) => {
      setNovaCandles((prev) => [
        ...prev.slice(-99),
        {
          time: Math.floor(new Date(candle.timestamp).getTime() / 1000) as any,
          open: parseFloat(candle.open),
          high: parseFloat(candle.high),
          low: parseFloat(candle.low),
          close: parseFloat(candle.close),
        },
      ]);
    });

    socket.on('round:started', (round: any) => {
      setActiveRound(round);
    });

    // Fetch initial Nova candles
    fetch(`${API_BASE}/api/market/candles?limit=50`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          const formatted = data.data.map((c: any) => ({
            time: Math.floor(new Date(c.timestamp).getTime() / 1000),
            open: parseFloat(c.open),
            high: parseFloat(c.high),
            low: parseFloat(c.low),
            close: parseFloat(c.close),
          }));
          setNovaCandles(formatted);
        }
      })
      .catch(console.error);

    // Fetch active round
    fetch(`${API_BASE}/api/game/rounds/active`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data && data.data.length > 0) {
          setActiveRound(data.data[0]);
        }
      })
      .catch(console.error);

    return () => {
      socket.disconnect();
    };
  }, []);

  // 3. 60-SECOND ARENA COUNTDOWN & ROUND ROLLOVERS
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const seconds = now.getSeconds();
      const remaining = 60 - seconds;
      setTimeLeft(remaining);

      // Rollover strike price every round
      if (remaining === 60 || remaining === 1) {
        if (btcPrice > 0) {
          setBtcRoundStrikePrice(btcPrice);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [btcPrice]);

  const activeDisplayPrice = selectedAsset === 'BTC' ? btcPrice : novaPrice;
  const activeCandles = selectedAsset === 'BTC' ? btcCandles : novaCandles;
  const activeStrikePrice = selectedAsset === 'BTC' ? btcRoundStrikePrice : (activeRound?.openPrice ? parseFloat(activeRound.openPrice) : novaPrice);

  const placeBet = (direction: 'UP' | 'DOWN') => {
    if (balance.usdt < betAmount) {
      setBetStatus('❌ Insufficient Demo USDT!');
      setTimeout(() => setBetStatus(null), 3000);
      return;
    }

    setBalance((b) => ({ ...b, usdt: b.usdt - betAmount }));
    const newBet = {
      id: Date.now(),
      asset: selectedAsset,
      direction,
      amount: betAmount,
      strikePrice: activeDisplayPrice,
      status: 'ACTIVE',
      roundTime: '60s',
    };

    setPredictions([newBet, ...predictions]);
    setBetStatus(`✅ Locked ${betAmount} USDT on ${selectedAsset} ${direction}!`);
    setTimeout(() => setBetStatus(null), 3000);
  };

  const handleDemoRecharge = () => {
    setBalance((b) => ({ ...b, usdt: b.usdt + 1000 }));
    setBetStatus('🎉 Added +1,000 USDT to Demo Wallet!');
    setTimeout(() => setBetStatus(null), 2500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0a0b0e', color: '#f3f4f6' }}>
      {/* Top Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: '#12141a',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #00f0b5 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '900',
              color: '#000',
              fontSize: '18px',
            }}
          >
            ₿
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '-0.5px' }}>
                NOVA<span style={{ color: '#00f0b5' }}>X</span>
              </span>
              <span
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  color: '#f59e0b',
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontWeight: '700',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                }}
              >
                LIVE ARENA
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { id: 'trade', label: '⚡ Prediction Arena' },
            { id: 'packages', label: 'VIP Packages' },
            { id: 'wallet', label: 'Wallet & Swap' },
            { id: 'referrals', label: 'Affiliates' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                background: activeTab === tab.id ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                color: activeTab === tab.id ? '#00f0b5' : '#9ca3af',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* User Balances */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              display: 'flex',
              gap: '14px',
              backgroundColor: '#181b22',
              padding: '6px 16px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '13px',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            <div>
              <span style={{ color: '#9ca3af', marginRight: '4px' }}>USDT:</span>
              <strong style={{ color: '#10b981' }}>${balance.usdt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
            </div>
            <div>
              <span style={{ color: '#9ca3af', marginRight: '4px' }}>NOVA:</span>
              <strong style={{ color: '#8b5cf6' }}>{balance.nova.toLocaleString()}</strong>
            </div>
          </div>
          <button
            onClick={handleDemoRecharge}
            style={{
              background: 'linear-gradient(135deg, #00f0b5 0%, #10b981 100%)',
              color: '#000',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontWeight: '700',
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(0, 240, 181, 0.2)',
            }}
          >
            + Free Funds
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      {activeTab === 'trade' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', flex: 1, overflow: 'hidden' }}>
          {/* Chart Section */}
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid rgba(255, 255, 255, 0.08)' }}>
            {/* Asset Selector & Live Stats Bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 24px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                backgroundColor: '#12141a',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                {/* Asset Switcher Buttons */}
                <div style={{ display: 'flex', backgroundColor: '#181b22', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <button
                    onClick={() => setSelectedAsset('BTC')}
                    style={{
                      background: selectedAsset === 'BTC' ? '#f59e0b' : 'transparent',
                      color: selectedAsset === 'BTC' ? '#000' : '#9ca3af',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 14px',
                      fontWeight: '800',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>🔥 BTC / USDT</span>
                    <span style={{ fontSize: '10px', opacity: 0.8 }}>(REAL)</span>
                  </button>
                  <button
                    onClick={() => setSelectedAsset('NOVA')}
                    style={{
                      background: selectedAsset === 'NOVA' ? '#8b5cf6' : 'transparent',
                      color: selectedAsset === 'NOVA' ? '#fff' : '#9ca3af',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 14px',
                      fontWeight: '800',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    NOVA / USDT
                  </button>
                </div>

                {/* Live Real Price Indicator */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                  <span
                    style={{
                      fontSize: '22px',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontWeight: '800',
                      color: selectedAsset === 'BTC' ? '#00f0b5' : (novaPrice >= 1 ? '#10b981' : '#ef4444'),
                    }}
                  >
                    ${activeDisplayPrice > 0 ? activeDisplayPrice.toLocaleString(undefined, { minimumFractionDigits: selectedAsset === 'BTC' ? 2 : 4 }) : 'Connecting...'}
                  </span>
                  {selectedAsset === 'BTC' && (
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        fontSize: '13px',
                        fontWeight: '700',
                        color: btcChange24h >= 0 ? '#10b981' : '#ef4444',
                      }}
                    >
                      {btcChange24h >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                      {btcChange24h >= 0 ? `+${btcChange24h.toFixed(2)}%` : `${btcChange24h.toFixed(2)}%`}
                    </span>
                  )}
                </div>

                {/* Real Stream Status Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#10b981' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} className="animate-live" />
                  <span style={{ fontWeight: '600' }}>
                    {selectedAsset === 'BTC' ? 'Binance Live Stream (1s Ticks)' : 'Simulated Nova Feed'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#9ca3af' }}>
                <span>Interval: <strong style={{ color: '#fff' }}>1m Candlesticks</strong></span>
              </div>
            </div>

            {/* Candlestick Chart View */}
            <div style={{ flex: 1, minHeight: '450px', position: 'relative', width: '100%', height: '100%' }}>
              <TradingChart
                candles={activeCandles}
                currentPrice={activeDisplayPrice}
                openPrice={activeStrikePrice}
                symbol={selectedAsset === 'BTC' ? 'BTC/USDT' : 'NOVA/USDT'}
              />
            </div>
          </div>

          {/* NOVA Prediction Arena Controls Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', padding: '24px', backgroundColor: '#12141a', gap: '20px', overflowY: 'auto' }}>
            {/* Arena Header & Countdown */}
            <div
              style={{
                background: 'linear-gradient(180deg, rgba(24, 27, 34, 0.9) 0%, rgba(18, 20, 26, 0.9) 100%)',
                borderRadius: '16px',
                padding: '20px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                textAlign: 'center',
                boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700' }}>
                  {selectedAsset} Prediction Arena
                </span>
                <span style={{ fontSize: '11px', color: '#00f0b5', fontWeight: '700' }}>1-MIN ROUND</span>
              </div>

              <div
                style={{
                  fontSize: '44px',
                  fontWeight: '900',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: timeLeft <= 10 ? '#ef4444' : '#00f0b5',
                  margin: '10px 0',
                  letterSpacing: '-1px',
                }}
              >
                00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#9ca3af', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <span>Strike Price:</span>
                <strong style={{ color: '#fff', fontFamily: 'JetBrains Mono, monospace' }}>
                  ${activeStrikePrice > 0 ? activeStrikePrice.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '...'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                <span>Payout Multiplier:</span>
                <strong style={{ color: '#10b981' }}>1.95x (+95%)</strong>
              </div>
            </div>

            {betStatus && (
              <div
                style={{
                  backgroundColor: 'rgba(0, 240, 181, 0.12)',
                  border: '1px solid rgba(0, 240, 181, 0.3)',
                  color: '#00f0b5',
                  padding: '12px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  textAlign: 'center',
                  fontWeight: '600',
                }}
              >
                {betStatus}
              </div>
            )}

            {/* Bet Amount Picker */}
            <div>
              <label style={{ fontSize: '12px', color: '#9ca3af', display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                Prediction Amount (USDT)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
                {[25, 50, 100, 250].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setBetAmount(amt)}
                    style={{
                      background: betAmount === amt ? '#00f0b5' : '#181b22',
                      color: betAmount === amt ? '#000' : '#f3f4f6',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      padding: '10px 0',
                      fontWeight: '800',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(Math.max(1, Number(e.target.value)))}
                style={{
                  width: '100%',
                  backgroundColor: '#181b22',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  padding: '12px',
                  color: '#fff',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '15px',
                  outline: 'none',
                }}
              />
            </div>

            {/* Action Buttons: BULL / BEAR */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <button
                onClick={() => placeBet('UP')}
                className="glow-btn-up"
                style={{
                  padding: '18px 12px',
                  borderRadius: '12px',
                  border: 'none',
                  color: '#fff',
                  fontWeight: '800',
                  fontSize: '15px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <TrendingUp size={26} />
                <span>UP / BULL</span>
                <span style={{ fontSize: '11px', opacity: 0.9 }}>Win ${(betAmount * 1.95).toFixed(2)}</span>
              </button>

              <button
                onClick={() => placeBet('DOWN')}
                className="glow-btn-down"
                style={{
                  padding: '18px 12px',
                  borderRadius: '12px',
                  border: 'none',
                  color: '#fff',
                  fontWeight: '800',
                  fontSize: '15px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <TrendingDown size={26} />
                <span>DOWN / BEAR</span>
                <span style={{ fontSize: '11px', opacity: 0.9 }}>Win ${(betAmount * 1.95).toFixed(2)}</span>
              </button>
            </div>

            {/* Active Tickets List */}
            <div style={{ flex: 1, marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '700' }}>
                  Your Active Arena Tickets
                </span>
                <span style={{ fontSize: '11px', color: '#6b7280' }}>{predictions.length} Tickets</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {predictions.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#6b7280', textAlign: 'center', padding: '24px 0', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                    No predictions placed yet this round.
                  </div>
                ) : (
                  predictions.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        backgroundColor: '#181b22',
                        borderRadius: '10px',
                        padding: '12px 14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '12px',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: '700', color: '#f59e0b' }}>{p.asset}</span>
                          <strong style={{ color: p.direction === 'UP' ? '#10b981' : '#ef4444' }}>
                            {p.direction}
                          </strong>
                        </div>
                        <div style={{ color: '#9ca3af', fontSize: '11px', marginTop: '2px', fontFamily: 'JetBrains Mono, monospace' }}>
                          ${p.amount} USDT • Entry: ${p.strikePrice?.toFixed(2)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: '#00f0b5', fontWeight: '700' }}>In Play</span>
                        <div style={{ color: '#10b981', fontSize: '11px' }}>+${(p.amount * 0.95).toFixed(2)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Packages Tab */}
      {activeTab === 'packages' && (
        <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px' }}>Digital Packages & VIP Yields</h2>
          <p style={{ color: '#9ca3af', marginBottom: '32px' }}>
            Earn daily simulated yields by holding high-tier memberships paid in NOVA tokens.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
            {[
              { name: 'Silver', price: 100, dailyYield: '0.8%', duration: '30 Days', color: '#9ca3af' },
              { name: 'Gold', price: 500, dailyYield: '1.2%', duration: '60 Days', color: '#f59e0b' },
              { name: 'Platinum', price: 2000, dailyYield: '1.8%', duration: '90 Days', color: '#00f0b5' },
              { name: 'Diamond', price: 5000, dailyYield: '2.5%', duration: '120 Days', color: '#8b5cf6' },
            ].map((pkg) => (
              <div
                key={pkg.name}
                style={{
                  backgroundColor: '#12141a',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div style={{ fontSize: '18px', fontWeight: '700', color: pkg.color }}>{pkg.name}</div>
                <div style={{ fontSize: '28px', fontWeight: '800' }}>{pkg.price} <span style={{ fontSize: '14px', color: '#9ca3af' }}>NOVA</span></div>
                <div style={{ fontSize: '13px', color: '#9ca3af' }}>Daily Yield: <strong style={{ color: '#10b981' }}>{pkg.dailyYield}</strong></div>
                <div style={{ fontSize: '13px', color: '#9ca3af' }}>Lock Period: <strong>{pkg.duration}</strong></div>
                <button
                  style={{
                    marginTop: 'auto',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    border: 'none',
                    padding: '10px',
                    borderRadius: '8px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Activate Tier
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Wallet Tab */}
      {activeTab === 'wallet' && (
        <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '20px' }}>Instant Token Swap</h2>
          <div style={{ backgroundColor: '#12141a', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>You Pay</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                <input
                  type="number"
                  defaultValue="100"
                  style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '24px', outline: 'none' }}
                />
                <span style={{ fontWeight: '700' }}>USDT</span>
              </div>
            </div>
            <div style={{ textAlign: 'center', margin: '12px 0' }}>
              <RefreshCw size={20} color="#00f0b5" style={{ cursor: 'pointer' }} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>You Receive</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                <input
                  type="number"
                  defaultValue="100"
                  readOnly
                  style={{ background: 'transparent', border: 'none', color: '#00f0b5', fontSize: '24px', outline: 'none' }}
                />
                <span style={{ fontWeight: '700' }}>NOVA</span>
              </div>
            </div>
            <button
              onClick={() => {
                setBalance((b) => ({ usdt: b.usdt - 50, nova: b.nova + 50 }));
                alert('Swapped 50 USDT to 50 NOVA!');
              }}
              style={{
                width: '100%',
                backgroundColor: '#00f0b5',
                color: '#000',
                border: 'none',
                padding: '14px',
                borderRadius: '10px',
                fontWeight: '800',
                cursor: 'pointer',
              }}
            >
              Confirm Swap
            </button>
          </div>
        </div>
      )}

      {/* Referrals Tab */}
      {activeTab === 'referrals' && (
        <div style={{ padding: '40px', maxWidth: '700px', margin: '0 auto', width: '100%' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px' }}>Affiliate & Referral Network</h2>
          <p style={{ color: '#9ca3af', marginBottom: '24px' }}>
            Earn 5% direct commission on trades and package unlocks from your network.
          </p>
          <div style={{ backgroundColor: '#12141a', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>Your Invite Code</span>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px', marginBottom: '20px' }}>
              <input
                readOnly
                value="NOVAX-9821"
                style={{
                  flex: 1,
                  backgroundColor: '#181b22',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '12px',
                  borderRadius: '8px',
                  color: '#00f0b5',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              />
              <button
                onClick={() => alert('Referral link copied to clipboard!')}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  border: 'none',
                  padding: '0 20px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                Copy Link
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ backgroundColor: '#181b22', padding: '16px', borderRadius: '10px' }}>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>Level 1 Referrals</span>
                <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '4px' }}>14</div>
              </div>
              <div style={{ backgroundColor: '#181b22', padding: '16px', borderRadius: '10px' }}>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>Commission Earned</span>
                <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '4px', color: '#10b981' }}>$342.50</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
