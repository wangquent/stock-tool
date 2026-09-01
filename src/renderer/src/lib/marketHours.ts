export function shanghaiNow(date = new Date()): Date {
  const text = date.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' })
  return new Date(text)
}

export function isTradingSession(date = new Date()): boolean {
  const now = shanghaiNow(date)
  const weekday = now.getDay()
  if (weekday === 0 || weekday === 6) return false

  const minutes = now.getHours() * 60 + now.getMinutes()
  const morning = minutes >= 9 * 60 + 15 && minutes <= 11 * 60 + 32
  const afternoon = minutes >= 12 * 60 + 58 && minutes <= 15 * 60 + 5
  return morning || afternoon
}

export function parseBusinessDay(time: string): { year: number; month: number; day: number } | null {
  const match = time.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

/** 把分时时钟压成连续时间轴，去掉 11:30–13:00 午休空洞 */
export function compressIntradayTime(time: string): number {
  const stamp = time.replace('T', ' ')
  const datePart = stamp.slice(0, 10)
  const hm = stamp.slice(11, 16)
  const [hour, minute] = hm.split(':').map(Number)
  let minutes = hour * 60 + minute
  if (minutes >= 13 * 60) {
    minutes -= 90
  }
  const base = Date.parse(`${datePart}T00:00:00Z`) / 1000
  return base + (minutes - (9 * 60 + 30)) * 60
}

export function formatClock(time: string): string {
  const hm = time.replace('T', ' ').slice(11, 16)
  return hm || time
}
