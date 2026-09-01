import { useEffect, useMemo, useState } from 'react'
import type { Candle, PriceBox, Quote, SRLevel, TrendPoint } from '../../../shared/types'
import { detectBoxes } from '../lib/boxChart'
import { changeClass, formatAmount, formatChange, formatPct, formatPrice } from '../lib/format'
import { isTradingSession } from '../lib/marketHours'
import { computeSupportResistance } from '../lib/supportResistance'
import { useAppStore } from '../store/useAppStore'
import { StockChart } from './StockChart'
import { Toolbox } from './Toolbox'

export function StockDetail(): JSX.Element {
  const selected = useAppStore((s) => s.selected)
  const quotes = useAppStore((s) => s.quotes)
  const setQuotes = useAppStore((s) => s.setQuotes)
  const chartTab = useAppStore((s) => s.chartTab)
  const setChartTab = useAppStore((s) => s.setChartTab)
  const toolboxOpen = useAppStore((s) => s.toolboxOpen)
  const setToolboxOpen = useAppStore((s) => s.setToolboxOpen)
  const boxEnabled = useAppStore((s) => s.boxEnabled)
  const boxSensitivity = useAppStore((s) => s.boxSensitivity)
  const srEnabled = useAppStore((s) => s.srEnabled)
  const srMethods = useAppStore((s) => s.srMethods) ?? []
  const watchlist = useAppStore((s) => s.watchlist)
  const setWatchlist = useAppStore((s) => s.setWatchlist)

  const [candles, setCandles] = useState<Candle[]>([])
  const [trends, setTrends] = useState<TrendPoint[]>([])
  const [quote, setQuote] = useState<Quote | null>(null)

  useEffect(() => {
    if (!selected) {
      setCandles([])
      setTrends([])
      setQuote(null)
      return
    }

    let disposed = false
    const load = async (): Promise<void> => {
      try {
        const [nextQuote, nextCandles, nextTrends] = await Promise.all([
          window.api.getQuote(selected.secid),
          window.api.getDailyKline(selected.secid),
          window.api.getIntraday(selected.secid)
        ])
        if (disposed) return
        if (nextQuote) {
          setQuote(nextQuote)
          setQuotes([nextQuote])
        }
        setCandles(nextCandles)
        setTrends(nextTrends)
      } catch {
        if (!disposed) {
          setCandles([])
          setTrends([])
        }
      }
    }

    void load()
    const trading = isTradingSession()
    const timer = trading ? window.setInterval(() => void load(), 3000) : undefined
    return () => {
      disposed = true
      if (timer) window.clearInterval(timer)
    }
  }, [selected, setQuotes])

  const boxes: PriceBox[] = useMemo(
    () => (boxEnabled ? detectBoxes(candles, boxSensitivity) : []),
    [boxEnabled, boxSensitivity, candles]
  )
  const srLevels: SRLevel[] = useMemo(
    () => (srEnabled ? computeSupportResistance(candles, srMethods ?? []) : []),
    [srEnabled, srMethods, candles]
  )

  if (!selected) {
    return (
      <section className="detail">
        <div className="empty">搜索或从自选中选择一只股票</div>
      </section>
    )
  }

  const live = quote ?? quotes[selected.secid]
  const inWatchlist = watchlist.some((item) => item.secid === selected.secid)
  const cls = changeClass(live?.changePct ?? 0)

  return (
    <section className="detail">
      <div className="quote-bar">
        <div className="quote-title">
          <h1>{selected.name}</h1>
          <span className="market-tag">
            {selected.code} · {selected.market}
          </span>
        </div>
        <div className={`quote-price ${cls}`}>{live ? formatPrice(live.price) : '--'}</div>
        <div className={`quote-stats ${cls}`}>
          <span>{live ? formatChange(live.change) : '--'}</span>
          <span>{live ? formatPct(live.changePct) : '--'}</span>
        </div>
        <div className="quote-stats">
          <span>今开 {live ? formatPrice(live.open) : '--'}</span>
          <span>最高 {live ? formatPrice(live.high) : '--'}</span>
          <span>最低 {live ? formatPrice(live.low) : '--'}</span>
          <span>额 {live ? formatAmount(live.amount) : '--'}</span>
        </div>
        <button
          type="button"
          className="tab"
          onClick={async () => {
            const items = inWatchlist
              ? await window.api.watchlistRemove(selected.secid)
              : await window.api.watchlistAdd(selected)
            setWatchlist(items)
          }}
        >
          {inWatchlist ? '删自选' : '加自选'}
        </button>
        <button
          type="button"
          className={`tool-btn ${toolboxOpen ? 'active' : ''}`}
          onClick={() => setToolboxOpen(!toolboxOpen)}
        >
          工具箱
        </button>
      </div>
      <div className="chart-tabs">
        <button
          type="button"
          className={`tab ${chartTab === 'intraday' ? 'active' : ''}`}
          onClick={() => setChartTab('intraday')}
        >
          分时
        </button>
        <button
          type="button"
          className={`tab ${chartTab === 'daily' ? 'active' : ''}`}
          onClick={() => setChartTab('daily')}
        >
          日K
        </button>
      </div>
      <StockChart
        tab={chartTab}
        candles={candles}
        trends={trends}
        boxes={boxes}
        boxEnabled={boxEnabled && chartTab === 'daily'}
        srLevels={chartTab === 'daily' && Array.isArray(srLevels) ? srLevels : []}
      />
      <Toolbox boxes={boxes} srLevels={srLevels} />
    </section>
  )
}
