import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'
import { api } from '@/services/api'
import type { Market } from '@/services/api'

export function PreviewMarkets() {
  const [items, setItems] = useState<Market[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const data = await api.getMarkets(6)
        setItems(data)
      } catch (err: any) {
        setError(err.message || 'Failed to load preview')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const truncate = (s?: string, n = 120) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s)

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
        <p className="mt-3 text-base text-fog md:text-lg">Curated catalogs of live, priced data</p>
      </motion.div>

      {loading && <div className="mt-8 text-fog">Loading…</div>}
      {error && !loading && <div className="mt-8 text-ember">{error}</div>}
      {!loading && !error && (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((m, i) => (
            <motion.div
              key={m._id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.05 }}
              className="rounded-2xl border border-white/10 bg-transparent p-5 transition-colors hover:border-white/20"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="truncate text-parchment font-medium">{m.title}</h3>
                  {m.description && <p className="mt-1 text-xs text-fog">{truncate(m.description)}</p>}
                </div>
              </div>
              {m.tags && m.tags.length > 0 && (
                <div className="mt-3 flex gap-2">
                  {m.tags.slice(0,3).map((t) => (
                    <span key={t} className="rounded bg-white/5 px-2 py-0.5 text-xs text-fog">{t}</span>
                  ))}
                </div>
              )}
              <div className="mt-4 flex items-center justify-between">
                <div />
                <Button variant="ghost" className="h-9 border border-white/12 px-3 text-sm hover:bg-white/5" onClick={() => (window.location.href = `/markets/${encodeURIComponent(m.slug)}`)}>
                  Explore <ExternalLink className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  )
}
