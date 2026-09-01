import { describe, expect, it } from 'vitest'
import type { Candle } from '../../../shared/types'
import { detectBoxes } from './boxChart'

function candle(i: number, open: number, high: number, low: number, close: number): Candle {
  const day = 1 + (i % 28)
  const month = 1 + Math.floor(i / 28)
  return {
    time: `2024-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    open,
    high,
    low,
    close,
    volume: 1000
  }
}

function oscillating(count: number, low = 10, high = 12): Candle[] {
  const candles: Candle[] = []
  const mid = (low + high) / 2
  const amp = (high - low) / 2
  for (let i = 0; i < count; i++) {
    const phase = Math.sin((i / 5) * Math.PI)
    const close = mid + phase * amp * 0.92
    const isPeak = phase > 0.85
    const isTrough = phase < -0.85
    const highP = isPeak ? high : close + 0.22
    const lowP = isTrough ? low : close - 0.22
    const open = i === 0 ? close : candles[i - 1].close
    candles.push(candle(i, open, highP, lowP, close))
  }
  return candles
}

function uptrend(count: number): Candle[] {
  const candles: Candle[] = []
  for (let i = 0; i < count; i++) {
    const open = 10 + i * 0.45
    const close = open + 0.32
    candles.push(candle(i, open, close + 0.08, open - 0.05, close))
  }
  return candles
}

function vShape(count: number): Candle[] {
  const candles: Candle[] = []
  const mid = Math.floor(count / 2)
  for (let i = 0; i < count; i++) {
    const close = i < mid ? 30 - i * 0.55 : 30 - mid * 0.55 + (i - mid) * 0.55
    const open = i === 0 ? close : candles[i - 1].close
    candles.push(candle(i, open, close + 0.12, close - 0.12, close))
  }
  return candles
}

describe('detectBoxes', () => {
  it('识别明显的水平整理箱体', () => {
    const boxes = detectBoxes(oscillating(60), 'standard')
    expect(boxes.length).toBeGreaterThan(0)
    const main = boxes[0]
    expect(main.topTouches).toBeGreaterThanOrEqual(2)
    expect(main.bottomTouches).toBeGreaterThanOrEqual(2)
    expect(main.high).toBeGreaterThan(main.low)
    expect(main.high - main.low).toBeGreaterThan(1)
    expect(main.high - main.low).toBeLessThan(3)
  })

  it('单边趋势不画箱体', () => {
    const boxes = detectBoxes(uptrend(50), 'standard')
    expect(boxes).toHaveLength(0)
  })

  it('宽幅无水平整理时不形成箱体', () => {
    const boxes = detectBoxes(vShape(50), 'standard')
    expect(boxes).toHaveLength(0)
  })
})
