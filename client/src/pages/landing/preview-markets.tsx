import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { CheckCircle, ExternalLink } from 'lucide-react'
import { api } from '@/services/api'
import type { CatalogResource } from '@/services/api'

export function PreviewMarkets() {
  const [items, setItems] = useState<CatalogResource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const data = await api.getCatalogResources(6)
        setItems(data)
      } catch (err: any) {
        setError(err.message || 'Failed to load preview')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  return (
    <section>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <h2 className="text-3xl font-medium tracking-tight md:text-4xl">Preview Markets</h2>
        <p className="mt-3 text-base text-fog md:text-lg">Live listings with price and source</p>
      </motion.div>

      {loading && <div className="mt-8 text-fog">Loading…</div>}
      {error && !loading && <div className="mt-8 text-ember">{error}</div>}
      {!loading && !error && (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((r, i) => (
            <motion.div
              key={r._id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.05 }}
              className="rounded-2xl border border-white/10 bg-transparent p-5 transition-colors hover:border-white/20"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-parchment font-medium">{r.title}</h3>
                    {r.verified && <CheckCircle className="h-4 w-4 text-sand flex-shrink-0" />}
                  </div>
                  <div className="mt-1 text-xs text-fog">
                    <span className="uppercase tracking-wider">{r.type}</span>
                    {r.domain && <span className="ml-2 text-fog/80">{r.domain}</span>}
                    {r.format && <span className="ml-2 text-fog/70">{r.format}</span>}
                  </div>
                </div>
                <div className="text-right whitespace-nowrap">
                  {r.price_flat && <div className="text-parchment font-medium">{formatCurrency(r.price_flat)}</div>}
                  {r.price_per_kb && <div className="text-sand text-sm">{formatCurrency(r.price_per_kb)}/KB</div>}
                </div>
              </div>
              {(r.sample_preview || r.summary) && (
                <p className="mt-3 line-clamp-3 rounded-lg bg-black/20 p-3 text-xs text-fog">{r.sample_preview || r.summary}</p>
              )}
              <div className="mt-4 flex items-center justify-between">
                <div className="flex gap-2 text-xs">
                  {r.tags?.slice(0, 2).map((t) => (
                    <span key={t} className="rounded bg-white/5 px-2 py-0.5 text-fog">{t}</span>
                  ))}
                </div>
                <Button variant="ghost" className="h-9 border border-white/12 px-3 text-sm hover:bg-white/5">
                  View <ExternalLink className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  )
}
