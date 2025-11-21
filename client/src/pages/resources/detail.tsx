import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, type CatalogResource } from '@/services/api'

export function ResourceDetailPage() {
  const { id = '' } = useParams()
  const [item, setItem] = useState<CatalogResource | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [walUsd, setWalUsd] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    ;(async () => {
      try {
        const [res, prices] = await Promise.all([
          api.getCatalogResource(id),
          api.getPrices().catch(() => ({ wal_usd: null })),
        ])
        setItem(res)
        setWalUsd(typeof prices.wal_usd === 'number' ? prices.wal_usd : null)
        setError('')
      } catch (e: any) {
        setError(e.message || 'Failed to load resource')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  return (
    <div className="min-h-screen bg-ink text-parchment">
      <div className="mx-auto max-w-3xl px-4 py-24 md:px-6">
        {loading && <div className="text-fog">Loading…</div>}
        {error && !loading && <div className="text-ember">{error}</div>}
        {!loading && item && (
          <div className="space-y-6">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/5">
                {item.image_url ? <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" /> : <div className="h-full w-full" />}
              </div>
              <div>
                <h1 className="text-2xl font-semibold">{item.title}</h1>
                <div className="mt-1 text-xs text-fog">
                  <span className="uppercase tracking-wider">{item.type}</span>
                  {item.domain && <span className="ml-2 text-fog/80">{item.domain}</span>}
                  {item.format && <span className="ml-2 text-fog/70">{item.format}</span>}
                  {item.category && <span className="ml-2 rounded bg-white/5 px-2 py-0.5">{item.category}</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-6 text-sm">
              {typeof item.price_flat === 'number' && (
                <div>
                  <span className="text-fog">Flat:</span>{' '}
                  {walUsd ? (
                    <>
                      {(item.price_flat / walUsd).toFixed(4)} WAL <span className="text-fog/70">(${item.price_flat.toFixed(2)})</span>
                    </>
                  ) : (
                    <>${item.price_flat.toFixed(2)}</>
                  )}
                </div>
              )}
              {typeof item.price_per_kb === 'number' && (
                <div>
                  <span className="text-fog">Per KB:</span>{' '}
                  {walUsd ? (
                    <>
                      {(item.price_per_kb / walUsd).toFixed(6)} WAL/KB <span className="text-fog/70">(${item.price_per_kb.toFixed(4)}/KB)</span>
                    </>
                  ) : (
                    <>${item.price_per_kb.toFixed(4)}/KB</>
                  )}
                </div>
              )}
            </div>
            {(item.sample_preview || item.summary) && (
              <div>
                <div className="text-xs uppercase tracking-widest text-white/40">Preview</div>
                <p className="mt-2 whitespace-pre-wrap rounded-lg border border-white/5 bg-white/5 p-3 text-sm text-fog">{item.sample_preview || item.summary}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
