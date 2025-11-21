import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, type MarketDetail } from '@/services/api'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'

export function MarketDetailPage() {
  const { slug = '' } = useParams()
  const [data, setData] = useState<MarketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [walUsd, setWalUsd] = useState<number | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const [res, prices] = await Promise.all([
          api.getMarket(slug),
          api.getPrices().catch(() => ({ wal_usd: null })),
        ])
        setData(res)
        setWalUsd(typeof prices.wal_usd === 'number' ? prices.wal_usd : null)
      } catch (e: any) {
        setError(e.message || 'Failed to load market')
      } finally {
        setLoading(false)
      }
    })()
  }, [slug])

  return (
    <div className="min-h-screen bg-ink text-parchment">
      <div className="mx-auto max-w-6xl px-4 py-24 md:px-6">
        {loading && <div className="text-fog">Loading…</div>}
        {error && !loading && <div className="text-ember">{error}</div>}
        {!loading && data && (
          <>
            <div className="text-center">
              <h1 className="text-3xl font-semibold md:text-4xl">{data.market.title}</h1>
              {data.market.description && <p className="mx-auto mt-2 max-w-2xl text-fog">{data.market.description}</p>}
              {data.market.tags && data.market.tags.length > 0 && (
                <div className="mt-3 flex justify-center gap-2">
                  {data.market.tags.slice(0, 8).map((t) => (
                    <span key={t} className="rounded bg-white/5 px-2 py-0.5 text-xs text-fog">{t}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.resources.map((r, i) => (
                <motion.div key={r._id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="rounded-2xl border border-white/10 bg-transparent p-5">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/5">
                      {r.image_url ? (
                        <img src={r.image_url} alt={r.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full" />
                      )}
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
                  <div className="mt-4 flex justify-end">
                    <Button variant="ghost" className="h-9 border border-white/12 px-3 text-sm hover:bg-white/5">
                      View <ExternalLink className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
