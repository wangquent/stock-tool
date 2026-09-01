import { useEffect } from 'react'
import { SearchBar } from './components/SearchBar'
import { StockDetail } from './components/StockDetail'
import { Watchlist } from './components/Watchlist'
import { isTradingSession } from './lib/marketHours'
import { useAppStore } from './store/useAppStore'

export default function App(): JSX.Element {
  const watchlist = useAppStore((s) => s.watchlist)
  const setWatchlist = useAppStore((s) => s.setWatchlist)
  const setQuotes = useAppStore((s) => s.setQuotes)

  useEffect(() => {
    if (!window.api) return
    void window.api.watchlistGet().then(setWatchlist)
  }, [setWatchlist])

  useEffect(() => {
    if (!window.api) return
    const load = async (): Promise<void> => {
      if (watchlist.length === 0) return
      const quotes = await window.api.getQuotes(watchlist.map((item) => item.secid))
      setQuotes(quotes)
    }
    void load()
    const trading = isTradingSession()
    const timer = trading ? window.setInterval(() => void load(), 6000) : undefined
    return () => {
      if (timer) window.clearInterval(timer)
    }
  }, [watchlist, setQuotes])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">行情工具</div>
        <SearchBar />
        <div className="disclaimer">数据来自第三方公开行情，仅供学习研究</div>
      </header>
      <div className="body">
        <Watchlist />
        <StockDetail />
      </div>
    </div>
  )
}
