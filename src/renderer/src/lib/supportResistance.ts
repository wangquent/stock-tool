import type { Candle, SRKind, SRLevel, SRMethod } from '../../../shared/types'
import { computeAtr, fractalSwings } from './boxChart'

export const SR_METHODS: {
  id: SRMethod
  label: string
  color: string
  hint: string
}[] = [
  {
    id: 'swing',
    label: '摆动点聚类',
    color: '#c084fc',
    hint: '多次水平触碰的高低点均值，与箱体同源'
  },
  {
    id: 'donchian',
    label: '近20日高低',
    color: '#22d3ee',
    hint: '近20根日K最高价/最低价，不要求反复验证'
  },
  {
    id: 'volume',
    label: '成交量分布',
    color: '#f0c14b',
    hint: '近80日成交最密的价位（POC）及70%价值区'
  },
  {
    id: 'fibonacci',
    label: '斐波那契回撤',
    color: '#f472b6',
    hint: '最近一轮摆动高低点的 0 / 38.2 / 50 / 61.8 / 100%'
  },
  {
    id: 'pivot',
    label: '经典枢轴点',
    color: '#94a3b8',
    hint: '用前一日最高、最低、收盘计算 PP / R1 / R2 / S1 / S2'
  }
]

function clusterMean(points: { price: number }[], tolerance: number): { price: number; count: number }[] {
  const sorted = [...points].sort((a, b) => a.price - b.price)
  const clusters: { prices: number[] }[] = []
  for (const point of sorted) {
    const found = clusters.find((c) => {
      const mean = c.prices.reduce((s, p) => s + p, 0) / c.prices.length
      return Math.abs(point.price - mean) <= tolerance
    })
    if (found) found.prices.push(point.price)
    else clusters.push({ prices: [point.price] })
  }
  return clusters
    .filter((c) => c.prices.length >= 2)
    .map((c) => ({
      price: c.prices.reduce((s, p) => s + p, 0) / c.prices.length,
      count: c.prices.length
    }))
}

function nearest(levels: { price: number; count: number }[], last: number, kind: SRKind, limit: number): SRLevel[] {
  const filtered =
    kind === 'resistance'
      ? levels.filter((l) => l.price >= last)
      : levels.filter((l) => l.price <= last)
  return filtered
    .sort((a, b) => Math.abs(a.price - last) - Math.abs(b.price - last))
    .slice(0, limit)
    .map((l) => ({
      method: 'swing' as const,
      kind,
      price: l.price,
      label: kind === 'resistance' ? `摆动压×${l.count}` : `摆动支×${l.count}`,
      explain: explainLevel(kind === 'resistance' ? '摆动压' : '摆动支')
    }))
}

export function swingLevels(candles: Candle[]): SRLevel[] {
  if (candles.length < 20) return []
  const atr = computeAtr(candles)
  if (atr <= 0) return []
  const { highs, lows } = fractalSwings(candles, 5)
  const last = candles[candles.length - 1].close
  const res = clusterMean(highs, 0.4 * atr)
  const sup = clusterMean(lows, 0.4 * atr)
  return [...nearest(res, last, 'resistance', 3), ...nearest(sup, last, 'support', 3)]
}

export function donchianLevels(candles: Candle[], lookback = 20): SRLevel[] {
  const slice = candles.slice(-lookback)
  if (slice.length < 5) return []
  const high = Math.max(...slice.map((c) => c.high))
  const low = Math.min(...slice.map((c) => c.low))
  return [
    { method: 'donchian', kind: 'resistance', price: high, label: `近${slice.length}日高`, explain: explainLevel('近20日高') },
    { method: 'donchian', kind: 'support', price: low, label: `近${slice.length}日低`, explain: explainLevel('近20日低') }
  ]
}

export function volumeLevels(candles: Candle[], lookback = 80, bins = 24): SRLevel[] {
  const slice = candles.slice(-Math.max(lookback, 10))
  const lo = Math.min(...slice.map((c) => c.low))
  const hi = Math.max(...slice.map((c) => c.high))
  if (!(hi > lo)) return []
  const step = (hi - lo) / bins
  const vol = new Array(bins).fill(0)
  for (const c of slice) {
    const typical = (c.high + c.low + c.close) / 3
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((typical - lo) / step)))
    vol[idx] += Math.max(c.volume, 0)
  }
  const total = vol.reduce((a, b) => a + b, 0)
  if (total <= 0) return []
  const pocIdx = vol.indexOf(Math.max(...vol))
  let loIdx = pocIdx
  let hiIdx = pocIdx
  let acc = vol[pocIdx]
  while (acc < total * 0.7 && (loIdx > 0 || hiIdx < bins - 1)) {
    const down = loIdx > 0 ? vol[loIdx - 1] : -1
    const up = hiIdx < bins - 1 ? vol[hiIdx + 1] : -1
    if (up >= down) {
      hiIdx += 1
      acc += vol[hiIdx]
    } else {
      loIdx -= 1
      acc += vol[loIdx]
    }
  }
  return [
    { method: 'volume', kind: 'resistance', price: lo + (hiIdx + 1) * step, label: '量VAH', explain: explainLevel('量VAH') },
    { method: 'volume', kind: 'mid', price: lo + (pocIdx + 0.5) * step, label: '量POC', explain: explainLevel('量POC') },
    { method: 'volume', kind: 'support', price: lo + loIdx * step, label: '量VAL', explain: explainLevel('量VAL') }
  ]
}

export function fibonacciLevels(candles: Candle[]): SRLevel[] {
  if (candles.length < 20) return []
  const { highs, lows } = fractalSwings(candles, 5)
  const lastHigh = highs[highs.length - 1]
  const lastLow = lows[lows.length - 1]
  let high: number
  let low: number
  if (lastHigh && lastLow) {
    high = lastHigh.price
    low = lastLow.price
  } else {
    const slice = candles.slice(-60)
    high = Math.max(...slice.map((c) => c.high))
    low = Math.min(...slice.map((c) => c.low))
  }
  if (!(high > low)) return []
  const range = high - low
  const fromHigh = !lastHigh || !lastLow || lastHigh.index >= lastLow.index
  const ratios = [0, 0.382, 0.5, 0.618, 1] as const
  const labels = ['Fib 0%', 'Fib 38.2%', 'Fib 50%', 'Fib 61.8%', 'Fib 100%']
  return ratios.map((ratio, index) => {
    const price = fromHigh ? high - range * ratio : low + range * ratio
    const kind: SRKind = ratio === 0.5 ? 'mid' : price >= (high + low) / 2 ? 'resistance' : 'support'
    return { method: 'fibonacci', kind, price, label: labels[index], explain: explainLevel(labels[index]) }
  })
}

export function pivotLevels(candles: Candle[]): SRLevel[] {
  if (candles.length < 2) return []
  const prev = candles[candles.length - 2]
  const pp = (prev.high + prev.low + prev.close) / 3
  const r1 = 2 * pp - prev.low
  const s1 = 2 * pp - prev.high
  const r2 = pp + (prev.high - prev.low)
  const s2 = pp - (prev.high - prev.low)
  return [
    { method: 'pivot', kind: 'resistance', price: r2, label: '枢轴R2', explain: explainLevel('枢轴R2') },
    { method: 'pivot', kind: 'resistance', price: r1, label: '枢轴R1', explain: explainLevel('枢轴R1') },
    { method: 'pivot', kind: 'mid', price: pp, label: '枢轴PP', explain: explainLevel('枢轴PP') },
    { method: 'pivot', kind: 'support', price: s1, label: '枢轴S1', explain: explainLevel('枢轴S1') },
    { method: 'pivot', kind: 'support', price: s2, label: '枢轴S2', explain: explainLevel('枢轴S2') }
  ]
}

const COMPUTE: Record<SRMethod, (candles: Candle[]) => SRLevel[]> = {
  swing: swingLevels,
  donchian: donchianLevels,
  volume: volumeLevels,
  fibonacci: fibonacciLevels,
  pivot: pivotLevels
}

export function computeSupportResistance(candles: Candle[], methods: SRMethod[]): SRLevel[] {
  if (!Array.isArray(candles) || !Array.isArray(methods)) return []
  const unique = [...new Set(methods)]
  const levels = unique.flatMap((method) => COMPUTE[method]?.(candles) ?? [])
  return levels
    .filter((l) => Number.isFinite(l.price))
    .map((l) => ({ ...l, explain: l.explain || explainLevel(l.label) }))
    .sort((a, b) => b.price - a.price)
}

export function methodColor(method: SRMethod): string {
  return SR_METHODS.find((m) => m.id === method)?.color ?? '#8b9bb4'
}

export function kindLabel(kind: SRKind): string {
  if (kind === 'resistance') return '压力'
  if (kind === 'support') return '支撑'
  return '中轴'
}

export function explainLevel(label: string): string {
  if (label.startsWith('摆动压')) {
    return '多个摆动高点落在同一价位附近后取均值。价格多次冲到这里回落，视为压力。×N 表示聚到这条线上的高点次数。'
  }
  if (label.startsWith('摆动支')) {
    return '多个摆动低点落在同一价位附近后取均值。价格多次跌到这里反弹，视为支撑。×N 表示聚到这条线上的低点次数。'
  }
  if (label.endsWith('日高')) {
    return '近一段交易日里出现过的最高价。这是窗口极值，不要求反复验证，短线常被当作压力。'
  }
  if (label.endsWith('日低')) {
    return '近一段交易日里出现过的最低价。这是窗口极值，不要求反复验证，短线常被当作支撑。'
  }
  const table: Record<string, string> = {
    量VAH: '成交量分布价值区上沿（Value Area High）。约 70% 成交发生在此价之下，上方常被看作压力。',
    量POC: '成交最密集的价位（Point of Control）。多空在这里换手最多，常作为短期平衡中轴。',
    量VAL: '成交量分布价值区下沿（Value Area Low）。约 70% 成交发生在此价之上，下方常被看作支撑。',
    'Fib 0%': '本轮摆动的起点一端。上涨波段里通常是最近高点，回撤尚未开始。',
    'Fib 38.2%': '斐波那契浅回撤位。涨完后回落到这里，常被看成偏强整理。',
    'Fib 50%': '一半回撤。不是黄金分割，但交易者用得很多，常作为多空分界的参考。',
    'Fib 61.8%': '黄金分割回撤。回落到这里仍视为趋势未坏的常见位置，也较容易变成支撑或压力。',
    'Fib 100%': '本轮摆动的另一端。上涨波段里通常是最近低点，若跌破则这轮摆动失效。',
    枢轴PP: '经典枢轴中枢 Pivot Point = (前一日最高 + 最低 + 收盘) / 3。视为今日多空平衡价。',
    枢轴R1: '第一阻力 Resistance 1 = 2×PP − 前低。价格上到这里常遇卖压，是最近的压力位。',
    枢轴R2: '第二阻力 Resistance 2 = PP + (前高 − 前低)。比 R1 更远的压力，突破 R1 后常看这里。',
    枢轴S1: '第一支撑 Support 1 = 2×PP − 前高。价格跌到这里常遇买盘，是最近的支撑位。',
    枢轴S2: '第二支撑 Support 2 = PP − (前高 − 前低)。比 S1 更远的支撑，跌破 S1 后常看这里。',
    箱顶: '整理箱体上沿。形成期内多次受阻的压力，收盘有效站上才算向上突破。',
    箱体中轴: '箱顶与箱底的中点，用来判断价格更靠近压力还是支撑。',
    箱底: '整理箱体下沿。形成期内多次获撑的支撑位，收盘有效跌破才算向下跌破。'
  }
  return table[label] ?? '该价位由所选算法算出，仅供对照研究，不构成买卖建议。'
}

export const BOX_MARK_EXPLAIN = {
  high: explainLevel('箱顶'),
  mid: explainLevel('箱体中轴'),
  low: explainLevel('箱底')
}
