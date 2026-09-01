import type { Candle, MarketName, Quote, StockIdentity, TrendPoint } from '../../shared/types'
import { cached } from './cache'

const SEARCH_TOKEN = 'D43BF722C8E33BDC906FB84D85E326E8'
const UT = 'fa5fd1943c7b386f172d6893dbfba10b'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

const SEARCH_TTL = 5_000
const QUOTE_TTL = 2_000
const INTRADAY_TTL = 2_000
const KLINE_TTL = 8_000

function toNumber(value: unknown, fallback = NaN): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  if (typeof value === 'string') {
    if (value === '-' || value === '') return fallback
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

function parseMaybeJsonp(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    const stripped = text.replace(/^[^(]*\(/, '').replace(/\)\s*;?\s*$/, '')
    return JSON.parse(stripped)
  }
}

async function getJson(url: string): Promise<unknown> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          Referer: 'https://quote.eastmoney.com/',
          Accept: 'application/json, text/plain, */*'
        },
        signal: AbortSignal.timeout(8000)
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const text = await res.text()
      return parseMaybeJsonp(text)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }
  throw lastError ?? new Error('请求失败')
}

const ASHARE_CLASSIFY = new Set(['AStock', 'NEEQ', '23'])

function marketFromQuoteId(secid: string, typeName?: string): MarketName {
  if (typeName?.includes('沪') || typeName?.includes('科创')) return '沪A'
  if (typeName?.includes('深') || typeName?.includes('创业')) return '深A'
  if (typeName?.includes('京') || typeName?.includes('北')) return '京A'
  if (secid.startsWith('1.')) return '沪A'
  if (secid.startsWith('0.')) return '深A'
  return '其他'
}

function isAShare(secid: string, code: string): boolean {
  return /^(0|1)\.\d{6}$/.test(secid) && /^\d{6}$/.test(code)
}

interface SuggestRow {
  Code?: string
  Name?: string
  QuoteID?: string
  SecurityTypeName?: string
  MktNum?: string
  Classify?: string
}

export async function searchStocks(keyword: string): Promise<StockIdentity[]> {
  const query = keyword.trim()
  if (!query) return []

  return cached(`search:${query}`, SEARCH_TTL, async () => {
    const url =
      `https://searchapi.eastmoney.com/api/suggest/get` +
      `?input=${encodeURIComponent(query)}&type=14&token=${SEARCH_TOKEN}&count=12`
    const json = (await getJson(url)) as {
      QuotationCodeTable?: { Data?: SuggestRow[] }
    }
    const rows = json.QuotationCodeTable?.Data ?? []
    const seen = new Set<string>()
    const result: StockIdentity[] = []
    for (const row of rows) {
      const code = String(row.Code ?? '')
      const secid = String(row.QuoteID ?? '')
      const name = String(row.Name ?? '')
      const classify = String(row.Classify ?? '')
      if (!isAShare(secid, code) || !name || seen.has(secid)) continue
      if (classify && !ASHARE_CLASSIFY.has(classify)) continue
      seen.add(secid)
      result.push({
        code,
        name,
        secid,
        market: marketFromQuoteId(secid, row.SecurityTypeName)
      })
    }
    return result
  })
}

function mapSnapshotQuote(raw: Record<string, unknown>, fallbackSecid?: string): Quote | null {
  const code = String(raw.f57 ?? '')
  const name = String(raw.f58 ?? '')
  const price = toNumber(raw.f43)
  if (!code || !Number.isFinite(price)) return null
  const prevClose = toNumber(raw.f60, price)
  return {
    secid: fallbackSecid || code,
    code,
    name,
    price,
    prevClose,
    open: toNumber(raw.f46, price),
    high: toNumber(raw.f44, price),
    low: toNumber(raw.f45, price),
    change: toNumber(raw.f169, price - prevClose),
    changePct: toNumber(raw.f170, prevClose ? ((price - prevClose) / prevClose) * 100 : 0),
    volume: toNumber(raw.f47, 0),
    amount: toNumber(raw.f48, 0),
    time: String(raw.f86 ?? '')
  }
}

function mapUlistQuote(raw: Record<string, unknown>): Quote | null {
  const code = String(raw.f12 ?? '')
  const name = String(raw.f14 ?? '')
  const marketNum = String(raw.f13 ?? '')
  const price = toNumber(raw.f2)
  if (!code || !Number.isFinite(price)) return null
  const prevClose = toNumber(raw.f18, price)
  return {
    secid: marketNum ? `${marketNum}.${code}` : code,
    code,
    name,
    price,
    prevClose,
    open: toNumber(raw.f17, price),
    high: toNumber(raw.f15, price),
    low: toNumber(raw.f16, price),
    change: toNumber(raw.f4, price - prevClose),
    changePct: toNumber(raw.f3, prevClose ? ((price - prevClose) / prevClose) * 100 : 0),
    volume: toNumber(raw.f5, 0),
    amount: toNumber(raw.f6, 0),
    time: ''
  }
}

export async function getQuote(secid: string): Promise<Quote | null> {
  if (!secid) return null
  return cached(`quote:${secid}`, QUOTE_TTL, async () => {
    const url =
      `https://push2.eastmoney.com/api/qt/stock/get?secid=${encodeURIComponent(secid)}` +
      `&ut=${UT}&fltt=2&invt=2&fields=f43,f44,f45,f46,f47,f48,f57,f58,f60,f86,f169,f170`
    const json = (await getJson(url)) as { data?: Record<string, unknown> }
    if (!json.data) return null
    return mapSnapshotQuote(json.data, secid)
  })
}

export async function getQuotes(secids: string[]): Promise<Quote[]> {
  const ids = [...new Set(secids.filter(Boolean))].slice(0, 50)
  if (ids.length === 0) return []
  if (ids.length === 1) {
    const one = await getQuote(ids[0])
    return one ? [one] : []
  }

  return cached(`quotes:${ids.join(',')}`, QUOTE_TTL, async () => {
    const url =
      `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&ut=${UT}` +
      `&secids=${encodeURIComponent(ids.join(','))}` +
      `&fields=f2,f3,f4,f5,f6,f12,f13,f14,f15,f16,f17,f18`
    const json = (await getJson(url)) as { data?: { diff?: Record<string, unknown>[] } }
    const rows = json.data?.diff ?? []
    const mapped = rows
      .map((row) => mapUlistQuote(row))
      .filter((q): q is Quote => q != null)

    if (mapped.length === 0) {
      const fallback: Quote[] = []
      for (const id of ids) {
        const q = await getQuote(id)
        if (q) fallback.push(q)
      }
      return fallback
    }
    return mapped
  })
}

export async function getDailyKline(secid: string): Promise<Candle[]> {
  if (!secid) return []
  return cached(`kline:${secid}`, KLINE_TTL, async () => {
    const url =
      `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${encodeURIComponent(secid)}` +
      `&ut=${UT}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61` +
      `&klt=101&fqt=1&end=20500101&lmt=400`
    const json = (await getJson(url)) as { data?: { klines?: string[] } }
    const klines = json.data?.klines ?? []
    return klines
      .map((line) => {
        const [time, open, close, high, low, volume] = line.split(',')
        return {
          time,
          open: toNumber(open),
          close: toNumber(close),
          high: toNumber(high),
          low: toNumber(low),
          volume: toNumber(volume, 0)
        }
      })
      .filter((c) => Number.isFinite(c.open) && Number.isFinite(c.close))
  })
}

export async function getIntraday(secid: string): Promise<TrendPoint[]> {
  if (!secid) return []
  return cached(`intraday:${secid}`, INTRADAY_TTL, async () => {
    const url =
      `https://push2.eastmoney.com/api/qt/stock/trends2/get?secid=${encodeURIComponent(secid)}` +
      `&ut=${UT}&ndays=1&iscr=0&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13` +
      `&fields2=f51,f52,f53,f54,f55,f56,f57,f58`
    const json = (await getJson(url)) as { data?: { trends?: string[] } }
    const trends = json.data?.trends ?? []
    return trends
      .map((line) => {
        const [time, price, , , , volume, , avg] = line.split(',')
        return {
          time,
          price: toNumber(price),
          avg: toNumber(avg),
          volume: toNumber(volume, 0)
        }
      })
      .filter((p) => Number.isFinite(p.price))
  })
}
