import { useEffect, useRef, useState } from 'react'
import type { StockIdentity } from '../../../shared/types'
import { useAppStore } from '../store/useAppStore'

export function SearchBar(): JSX.Element {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<StockIdentity[]>([])
  const [open, setOpen] = useState(false)
  const setSelected = useAppStore((s) => s.setSelected)
  const watchlistAdd = async (stock: StockIdentity): Promise<void> => {
    if (!window.api) return
    const items = await window.api.watchlistAdd(stock)
    useAppStore.getState().setWatchlist(items)
  }
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const q = keyword.trim()
      if (!q || !window.api) {
        setResults([])
        setOpen(false)
        return
      }
      try {
        const list = await window.api.searchStocks(q)
        setResults(list)
        setOpen(true)
      } catch {
        setResults([])
        setOpen(true)
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [keyword])

  useEffect(() => {
    const onClick = (event: MouseEvent): void => {
      if (!boxRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const pick = (stock: StockIdentity): void => {
    setSelected(stock)
    setOpen(false)
    setKeyword(`${stock.name} ${stock.code}`)
  }

  return (
    <div className="search-wrap" ref={boxRef}>
      <input
        className="search-input"
        placeholder="搜索股票名称或代码"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
      />
      {open && (
        <div className="search-dropdown">
          {results.length === 0 ? (
            <div className="empty">没有匹配的 A 股</div>
          ) : (
            results.map((stock) => (
              <div key={stock.secid} className="search-row">
                <button type="button" className="search-item" onClick={() => pick(stock)}>
                  <span className="search-code">{stock.code}</span>
                  <span className="search-name">{stock.name}</span>
                  <span className="market-tag">{stock.market}</span>
                </button>
                <button
                  type="button"
                  className="tab"
                  onClick={() => {
                    void watchlistAdd(stock)
                    pick(stock)
                  }}
                >
                  加自选
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
