import { useEffect, useRef } from 'react';
import { createChart, ColorType, type IChartApi, type ISeriesApi } from 'lightweight-charts';

export interface CandleData {
  time: any;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface TradingChartProps {
  candles: CandleData[];
  currentPrice: number;
  openPrice?: number;
  symbol?: string;
}

export function TradingChart({ candles, currentPrice, openPrice, symbol = 'BTC/USDT' }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    // Use current dimensions or fallback to parent sizes
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    const chart = createChart(container, {
      width,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#12141a' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        scaleMargins: {
          top: 0.15,
          bottom: 0.15,
        },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    });

    const series = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // Auto-fit data on first initialization if available
    if (candles.length > 0) {
      try {
        const sorted = [...candles]
          .filter((c) => c && c.time && !isNaN(c.close))
          .sort((a, b) => (Number(a.time) - Number(b.time)));
        series.setData(sorted);
        chart.timeScale().fitContent();
      } catch (err) {
        console.error('Initial setData error:', err);
      }
    }

    // ResizeObserver ensures chart responds immediately when container takes size
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !chartRef.current) return;
      const { width: newWidth, height: newHeight } = entries[0].contentRect;
      if (newWidth > 0 && newHeight > 0) {
        chartRef.current.applyOptions({
          width: Math.floor(newWidth),
          height: Math.floor(newHeight),
        });
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Update chart series data when candles prop updates
  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;

    try {
      // Ensure candles are sorted ascending by time and unique
      const sorted = [...candles]
        .filter((c) => c && c.time && !isNaN(c.close))
        .sort((a, b) => Number(a.time) - Number(b.time));

      // Remove duplicate timestamps to prevent lightweight-charts errors
      const unique: CandleData[] = [];
      const seen = new Set<number>();
      for (const item of sorted) {
        const t = Number(item.time);
        if (!seen.has(t)) {
          seen.add(t);
          unique.push(item);
        } else {
          // Replace last one with latest update for same timestamp
          unique[unique.length - 1] = item;
        }
      }

      seriesRef.current.setData(unique);
    } catch (err) {
      console.error('Error applying chart candles:', err);
    }
  }, [candles]);

  const pricePrecision = symbol.includes('BTC') ? 2 : 4;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '400px' }}>
      <div
        ref={chartContainerRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />
      {openPrice !== undefined && openPrice > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '16px',
            backgroundColor: 'rgba(24, 27, 34, 0.85)',
            backdropFilter: 'blur(8px)',
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '12px',
            fontFamily: 'JetBrains Mono, monospace',
            display: 'flex',
            gap: '16px',
            zIndex: 10,
          }}
        >
          <span>Round Strike: <strong style={{ color: '#00f0b5' }}>${openPrice.toFixed(pricePrecision)}</strong></span>
          <span>Live: <strong style={{ color: currentPrice >= openPrice ? '#10b981' : '#ef4444' }}>${currentPrice.toFixed(pricePrecision)}</strong></span>
        </div>
      )}
    </div>
  );
}
