import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { api, type CatalogResource } from '@/services/api'
import { Search, ChevronDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function MarketsPage() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<CatalogResource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [walUsd, setWalUsd] = useState<number | null>(null)
  const debounceRef = useRef<number | null>(null)

  const fetchData = async (opts?: { category?: string; q?: string }) => {
    setLoading(true)
    try {
      const [cats, res, prices] = await Promise.all([
        categories.length ? Promise.resolve(categories) : api.getMarketCategories(),
        api.getCatalogResources({ limit: 30, category: opts?.category, q: opts?.q }),
        api.getPrices().catch(() => ({ wal_usd: null })),
      ])
      if (!categories.length) setCategories(cats)
      setItems(res)
      setWalUsd(typeof prices.wal_usd === 'number' ? prices.wal_usd : null)
      setError('')
    } catch (e: any) {
      setError(e.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      fetchData({ category: selectedCategory || undefined, q: query || undefined })
    }, 400) as unknown as number
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, query])

  return (
    <div className="min-h-screen bg-ink text-parchment">
      <div className="mx-auto max-w-6xl px-4 py-24 md:px-6">
        <div className="text-center">
          <h1 className="text-3xl font-semibold md:text-4xl">Data Markets</h1>
          <p className="mt-2 text-fog">Browse live resources; filter by category or search</p>
        </div>

        <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex w-full items-center gap-2 md:max-w-md">
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fog" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search resources…"
                className="w-full rounded-full border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-parchment placeholder:text-fog/70 focus:border-white/40 focus:outline-none"
              />
            </div>
          </div>
          <div className="w-full md:w-auto">
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  const el = (e.currentTarget.nextSibling as HTMLElement)
                  if (el) el.classList.toggle('hidden')
                }}
                className="flex w-full items-center justify-between rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-parchment hover:border-white/30 md:w-52"
              >
                <span>{selectedCategory || 'All categories'}</span>
                <ChevronDown className="h-4 w-4 text-fog" />
              </button>
              <div className="hidden absolute z-20 mt-2 w-full rounded-2xl border border-white/10 bg-[#121212]/95 p-1 shadow-2xl backdrop-blur">
                <button
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm ${!selectedCategory ? 'bg-white/10 text-parchment' : 'text-parchment hover:bg-white/10'}`}
                  onClick={() => setSelectedCategory('')}
                >
                  All categories
                </button>
                {categories.map((c) => (
                  <button
                    key={c}
                    className={`w-full rounded-xl px-3 py-2 text-left text-sm ${selectedCategory === c ? 'bg-white/10 text-parchment' : 'text-parchment hover:bg-white/10'}`}
                    onClick={() => setSelectedCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {loading && <div className="mt-10 text-fog">Loading…</div>}
        {error && !loading && <div className="mt-10 text-ember">{error}</div>}
        {!loading && !error && (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.length === 0 && (
              <div className="col-span-full rounded-xl border border-white/10 bg-white/5 p-6 text-center text-fog">No results</div>
            )}
            {items.map((r, i) => (
              <motion.button
                key={r._id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="rounded-2xl border border-white/10 bg-transparent p-5 text-left transition-colors hover:border-white/20"
                onClick={() => navigate(`/resources/${encodeURIComponent(r._id)}`)}
              >
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/5">
                    {r.image_url ? <img src={r.image_url} alt={r.title} className="h-full w-full object-cover" /> : <div className="h-full w-full" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-parchment font-medium">{r.title}</h3>
                        <div className="mt-1 text-xs text-fog">
                          <span className="uppercase tracking-wider">{r.type}</span>
                          {r.domain && <span className="ml-2 text-fog/80">{r.domain}</span>}
                          {r.format && <span className="ml-2 text-fog/70">{r.format}</span>}
                        </div>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        {typeof r.price_flat === 'number' && (
                          <div className="text-parchment font-medium">
                            {walUsd ? `${(r.price_flat / walUsd).toFixed(4)} WAL` : `$${r.price_flat.toFixed(2)}`}
                            {walUsd && <div className="text-xs text-fog">${r.price_flat.toFixed(2)}</div>}
                          </div>
                        )}
                        {typeof r.price_per_kb === 'number' && (
                          <div className="text-sand text-sm">
                            {walUsd ? `${(r.price_per_kb / walUsd).toFixed(6)} WAL/KB` : `$${r.price_per_kb.toFixed(4)}/KB`}
                            {walUsd && <div className="text-[11px] text-fog">${r.price_per_kb.toFixed(4)}/KB</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                {(r.sample_preview || r.summary) && (
                  <p className="mt-3 line-clamp-3 rounded-lg bg-white/5 p-3 text-xs text-fog">{r.sample_preview || r.summary}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  {r.category && <span className="rounded bg-white/5 px-2 py-0.5 text-fog">{r.category}</span>}
                  {r.tags?.slice(0, 2).map((t) => (
                    <span key={t} className="rounded bg-white/5 px-2 py-0.5 text-fog">{t}</span>
                  ))}
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
