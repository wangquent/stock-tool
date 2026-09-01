import { useEffect, useRef, useState } from 'react'
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type MouseEventParams,
  type SeriesType,
  type UTCTimestamp
} from 'lightweight-charts'
import type { Candle, PriceBox, SRLevel, TrendPoint } from '../../../shared/types'
import { BoxPrimitive } from '../lib/boxPrimitive'
import { BOX_MARK_EXPLAIN, explainLevel, methodColor } from '../lib/supportResistance'
import { compressIntradayTime, formatClock, parseBusinessDay } from '../lib/marketHours'

const UP = '#ef5350'
const DOWN = '#26a69a'

interface HoverMark {
  price: number
  label: string
  explain: string
}

interface ChartTip {
  x: number
  y: number
  label: string
  explain: string
  price: number
}

interface Props {
  tab: 'intraday' | 'daily'
  candles: Candle[]
  trends: TrendPoint[]
  boxes: PriceBox[]
  boxEnabled: boolean
  srLevels: SRLevel[]
}

export function StockChart({
  tab,
  candles,
  trends,
  boxes = [],
  boxEnabled = false,
  srLevels = []
}: Props): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null)
  const extraSeriesRef = useRef<ISeriesApi<SeriesType>[]>([])
  const primitiveRef = useRef<BoxPrimitive | null>(null)
  const priceLines = useRef<IPriceLine[]>([])
  const hoverMarks = useRef<HoverMark[]>([])
  const [tip, setTip] = useState<ChartTip | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const chart = createChart(host, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#0f1419' },
        textColor: '#8b9bb4',
        fontFamily: 'Segoe UI, Microsoft YaHei, sans-serif'
      },
      grid: {
        vertLines: { color: '#1c2430' },
        horzLines: { color: '#1c2430' }
      },
      rightPriceScale: { borderColor: '#243041' },
      timeScale: { borderColor: '#243041' },
      crosshair: { horzLine: { labelBackgroundColor: '#243041' } }
    })
    chartRef.current = chart

    const onResize = (): void => {
      chart.applyOptions({ width: host.clientWidth, height: host.clientHeight })
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      primitiveRef.current = null
      seriesRef.current = null
      extraSeriesRef.current = []
      chart.remove()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    if (seriesRef.current) {
      chart.removeSeries(seriesRef.current)
      seriesRef.current = null
    }
    for (const extra of extraSeriesRef.current) {
      chart.removeSeries(extra)
    }
    extraSeriesRef.current = []
    primitiveRef.current = null
    priceLines.current = []

    if (tab === 'daily') {
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: UP,
        downColor: DOWN,
        borderUpColor: UP,
        borderDownColor: DOWN,
        wickUpColor: UP,
        wickDownColor: DOWN
      })
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceScaleId: 'vol',
        priceFormat: { type: 'volume' }
      })
      chart.priceScale('vol').applyOptions({
        scaleMargins: { top: 0.78, bottom: 0 }
      })
      seriesRef.current = candleSeries
      extraSeriesRef.current = [volumeSeries]

      const primitive = new BoxPrimitive()
      candleSeries.attachPrimitive(primitive)
      primitiveRef.current = primitive

      const candleData = candles
        .map((c) => {
          const time = parseBusinessDay(c.time)
          if (!time) return null
          return { time, open: c.open, high: c.high, low: c.low, close: c.close }
        })
        .filter((c): c is NonNullable<typeof c> => c != null)
      candleSeries.setData(candleData)
      volumeSeries.setData(
        candles
          .map((c) => {
            const time = parseBusinessDay(c.time)
            if (!time) return null
            return {
              time,
              value: c.volume,
              color: c.close >= c.open ? 'rgba(239,83,80,0.45)' : 'rgba(38,166,154,0.45)'
            }
          })
          .filter((c): c is NonNullable<typeof c> => c != null)
      )
      chart.applyOptions({
        timeScale: {
          tickMarkFormatter: (time) => {
            if (typeof time === 'object' && time && 'year' in time) {
              const t = time as { year: number; month: number; day: number }
              return `${t.month}-${String(t.day).padStart(2, '0')}`
            }
            return ''
          }
        }
      })
      chart.timeScale().fitContent()
    } else {
      const line = chart.addSeries(LineSeries, {
        color: '#58a6ff',
        lineWidth: 2,
        priceLineVisible: false
      })
      const avg = chart.addSeries(LineSeries, {
        color: '#f0c14b',
        lineWidth: 1,
        priceLineVisible: false
      })
      seriesRef.current = line
      extraSeriesRef.current = [avg]
      const lineData = trends.map((p) => ({
        time: compressIntradayTime(p.time) as UTCTimestamp,
        value: p.price
      }))
      const avgData = trends
        .filter((p) => Number.isFinite(p.avg))
        .map((p) => ({
          time: compressIntradayTime(p.time) as UTCTimestamp,
          value: p.avg
        }))
      line.setData(lineData)
      avg.setData(avgData)
      chart.applyOptions({
        timeScale: {
          tickMarkFormatter: (time) => {
            const point = trends.find((p) => compressIntradayTime(p.time) === Number(time))
            return point ? formatClock(point.time) : ''
          }
        }
      })
      chart.timeScale().fitContent()
    }
  }, [tab, candles, trends])

  useEffect(() => {
    const series = seriesRef.current
    if (!series || tab !== 'daily') return

    for (const line of priceLines.current) {
      series.removePriceLine(line)
    }
    priceLines.current = []

    const visibleBoxes = boxEnabled && Array.isArray(boxes) ? boxes : []
    primitiveRef.current?.setBoxes(visibleBoxes)

    const nextLines: IPriceLine[] = []
    const main = visibleBoxes[0]
    if (main) {
      nextLines.push(
        series.createPriceLine({
          price: main.high,
          color: 'rgba(239, 83, 80, 0.85)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          title: `箱顶 ${main.high.toFixed(2)}`
        }),
        series.createPriceLine({
          price: main.mid,
          color: 'rgba(139, 155, 180, 0.7)',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          title: `中轴 ${main.mid.toFixed(2)}`
        }),
        series.createPriceLine({
          price: main.low,
          color: 'rgba(38, 166, 154, 0.85)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          title: `箱底 ${main.low.toFixed(2)}`
        })
      )
    }
    const marks: HoverMark[] = []
    if (main) {
      marks.push(
        { price: main.high, label: '箱顶', explain: BOX_MARK_EXPLAIN.high },
        { price: main.mid, label: '箱体中轴', explain: BOX_MARK_EXPLAIN.mid },
        { price: main.low, label: '箱底', explain: BOX_MARK_EXPLAIN.low }
      )
    }
    for (const level of Array.isArray(srLevels) ? srLevels : []) {
      nextLines.push(
        series.createPriceLine({
          price: level.price,
          color: methodColor(level.method),
          lineWidth: 1,
          lineStyle: level.kind === 'mid' ? LineStyle.Dotted : LineStyle.Dashed,
          title: `${level.label} ${level.price.toFixed(2)}`
        })
      )
      marks.push({
        price: level.price,
        label: level.label,
        explain: level.explain || explainLevel(level.label)
      })
    }
    hoverMarks.current = marks
    priceLines.current = nextLines
  }, [boxes, boxEnabled, srLevels, tab, candles])

  useEffect(() => {
    const chart = chartRef.current
    const series = seriesRef.current
    const host = hostRef.current
    if (!chart || !series || !host || tab !== 'daily') {
      setTip(null)
      return
    }

    const onMove = (param: MouseEventParams): void => {
      if (!param.point) {
        setTip(null)
        return
      }
      let best: HoverMark | null = null
      let bestDist = 14
      for (const mark of hoverMarks.current) {
        const y = series.priceToCoordinate(mark.price)
        if (y == null) continue
        const dist = Math.abs(y - param.point.y)
        if (dist < bestDist) {
          bestDist = dist
          best = mark
        }
      }
      if (!best) {
        setTip(null)
        return
      }
      const width = host.clientWidth
      const x = Math.min(Math.max(8, param.point.x + 16), Math.max(8, width - 240))
      const y = param.point.y < 90 ? param.point.y + 18 : param.point.y - 12
      setTip({
        x,
        y,
        label: best.label,
        explain: best.explain,
        price: best.price
      })
    }

    chart.subscribeCrosshairMove(onMove)
    return () => {
      chart.unsubscribeCrosshairMove(onMove)
      setTip(null)
    }
  }, [tab, candles, trends, srLevels, boxes, boxEnabled])

  return (
    <div className="chart-stage">
      <div className="chart-wrap">
        <div className="chart-canvas" ref={hostRef} />
        {tip && (
          <div
            className="chart-tip"
            style={{
              left: tip.x,
              top: tip.y,
              transform: tip.y < 90 ? 'none' : 'translateY(-100%)'
            }}
          >
            <strong>
              {tip.label} {tip.price.toFixed(2)}
            </strong>
            <p>{tip.explain}</p>
          </div>
        )}
      </div>
    </div>
  )
}
