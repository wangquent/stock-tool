import type { MouseEvent } from 'react'
import { changeClass, formatPct, formatPrice } from '../lib/format'
import { useAppStore } from '../store/useAppStore'

export function Watchlist(): JSX.Element {
  const watchlist = useAppStore((s) => s.watchlist)
  const quotes = useAppStore((s) => s.quotes)
  const selected = useAppStore((s) => s.selected)
  const setSelected = useAppStore((s) => s.setSelected)
  const setWatchlist = useAppStore((s) => s.setWatchlist)

  const remove = async (secid: string, event: MouseEvent): Promise<void> => {
    event.stopPropagation()
    const items = await window.api.watchlistRemove(secid)
    setWatchlist(items)
    if (selected?.secid === secid) {
      setSelected(items[0] ?? null)
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span>自选股</span>
        <span>{watchlist.length}</span>
      </div>
      <div className="watch-list">
        {watchlist.length === 0 ? (
          <div className="empty">搜索后加入自选</div>
        ) : (
          watchlist.map((stock) => {
            const quote = quotes[stock.secid]
            const pct = quote?.changePct ?? 0
            return (
              <div
                key={stock.secid}
                className={`watch-item ${selected?.secid === stock.secid ? 'active' : ''}`}
                onClick={() => setSelected(stock)}
              >
                <span className="watch-code">{stock.code}</span>
                <span className="watch-name">{stock.name}</span>
                <span className={`watch-meta ${changeClass(pct)}`}>
                  <span>{quote ? formatPrice(quote.price) : '--'}</span>
                  <span>{quote ? formatPct(pct) : '--'}</span>
                </span>
                <button
                  type="button"
                  className="remove-btn"
                  onClick={(e) => {
                    void remove(stock.secid, e)
                  }}
                >
                  ×
                </button>
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}
