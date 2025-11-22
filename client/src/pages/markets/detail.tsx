import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type CatalogResource } from '@/services/api'
import { ArrowLeft, FileText, CheckCircle, DollarSign, Database, Shield, Copy, Check } from 'lucide-react'
import { motion } from 'framer-motion'

export function MarketDetailPage() {
  const { slug: id = '' } = useParams()
  const navigate = useNavigate()
  const [resource, setResource] = useState<CatalogResource | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedItem, setCopiedItem] = useState<string>('')

  useEffect(() => {
    ; (async () => {
      try {
        const resources = await api.getCatalogResources()
        const found = resources.find(r => r._id === id)
        if (!found) throw new Error('Resource not found')
        setResource(found)
      } catch (e: any) {
        setError(e.message || 'Failed to load resource')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const handleCopy = async (text: string, itemId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedItem(itemId)
      setTimeout(() => setCopiedItem(''), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-ink text-parchment flex items-center justify-center">
        <div className="text-fog">Loading resource...</div>
      </div>
    )
  }

  if (error || !resource) {
    return (
      <div className="min-h-screen bg-ink text-parchment flex items-center justify-center">
        <div className="text-center">
          <div className="text-ember mb-4">{error || 'Resource not found'}</div>
          <button
            onClick={() => navigate('/markets')}
            className="text-parchment hover:text-parchment/80 underline"
          >
            Go to Markets
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ink text-parchment">
      <div className="mx-auto max-w-5xl px-4 py-12 md:px-6">
        {/* Back Button */}
        <button
          onClick={() => navigate('/markets')}
          className="mb-6 flex items-center gap-2 text-fog hover:text-parchment transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Markets</span>
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-white/10 to-white/5">
                  <FileText className="h-8 w-8 text-parchment" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-parchment">{resource.title}</h1>
                  {resource.verified && (
                    <div className="flex items-center gap-1.5 text-green-400 mt-1">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm">Verified Resource</span>
                    </div>
                  )}
                </div>
              </div>
              {resource.summary && (
                <p className="text-fog max-w-3xl">{resource.summary}</p>
              )}
            </div>
          </div>

          {/* Main Grid */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Info Card */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                <h2 className="text-xl font-semibold text-parchment mb-4">Resource Details</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-white/5 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-wider text-white/40 mb-2">Type</div>
                    <div className="text-parchment font-medium uppercase">{resource.type}</div>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-wider text-white/40 mb-2">Format</div>
                    <div className="text-parchment font-medium uppercase">{resource.format}</div>
                  </div>
                  {resource.size_bytes && (
                    <div className="rounded-lg border border-white/5 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-wider text-white/40 mb-2">Size</div>
                      <div className="text-parchment font-medium">{formatSize(resource.size_bytes)}</div>
                    </div>
                  )}
                  {resource.domain && (
                    <div className="rounded-lg border border-white/5 bg-white/5 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Database className="h-3.5 w-3.5 text-white/40" />
                        <div className="text-xs uppercase tracking-wider text-white/40">Domain</div>
                      </div>
                      <div className="text-parchment font-medium">{resource.domain}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Storage Information */}
              {((resource as any).walrus_blob_id || (resource as any).cipher_meta) && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                  <h2 className="text-xl font-semibold text-parchment mb-4">Storage Information</h2>
                  <div className="space-y-4">
                    {(resource as any).walrus_blob_id && (
                      <div className="rounded-lg border border-white/5 bg-white/5 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs uppercase tracking-wider text-white/40">Walrus Blob ID</div>
                          <button
                            onClick={() => handleCopy((resource as any).walrus_blob_id, 'walrus_blob')}
                            className="flex items-center gap-1 text-xs text-fog hover:text-parchment transition"
                          >
                            {copiedItem === 'walrus_blob' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            {copiedItem === 'walrus_blob' ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <div className="text-parchment font-mono text-sm break-all">
                          {(resource as any).walrus_blob_id}
                        </div>
                      </div>
                    )}
                    {(resource as any).cipher_meta && (
                      <div className="rounded-lg border border-white/5 bg-white/5 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Shield className="h-3.5 w-3.5 text-white/40" />
                          <div className="text-xs uppercase tracking-wider text-white/40">Encryption</div>
                        </div>
                        <div className="text-parchment font-medium uppercase">
                          {(resource as any).cipher_meta.algo || 'AES-256-GCM'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Preview */}
              {resource.sample_preview && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                  <h2 className="text-xl font-semibold text-parchment mb-4">Sample Preview</h2>
                  <div className="rounded-lg bg-white/5 p-4 text-sm text-fog whitespace-pre-wrap">
                    {resource.sample_preview}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Pricing */}
              <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="h-5 w-5 text-parchment" />
                  <h2 className="text-lg font-semibold text-parchment">Pricing</h2>
                </div>
                <div className="space-y-4">
                  {typeof resource.price_flat === 'number' && (
                    <div>
                      <div className="text-xs text-fog mb-1">Base Price</div>
                      <div className="text-3xl font-bold text-parchment">
                        {formatCurrency(resource.price_flat)}
                      </div>
                    </div>
                  )}
                  {typeof resource.price_per_kb === 'number' && (
                    <div className="pt-4 border-t border-white/10">
                      <div className="text-xs text-fog mb-1">Per Kilobyte</div>
                      <div className="text-xl font-semibold text-parchment">
                        {formatCurrency(resource.price_per_kb)}
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-6 space-y-3">
                  <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-wider text-white/40 mb-2">MCP Server URL</div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs text-parchment font-mono bg-black/20 rounded px-2 py-1.5 truncate">
                        {window.location.origin}/mcp
                      </code>
                      <button
                        onClick={() => handleCopy(`${window.location.origin}/mcp`, 'mcp_url')}
                        className="flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs text-parchment transition"
                      >
                        {copiedItem === 'mcp_url' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedItem === 'mcp_url' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-wider text-white/40 mb-2">Resource ID</div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs text-parchment font-mono bg-black/20 rounded px-2 py-1.5 truncate">
                        {resource._id}
                      </code>
                      <button
                        onClick={() => handleCopy(resource._id, 'resource_id')}
                        className="flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs text-parchment transition"
                      >
                        {copiedItem === 'resource_id' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedItem === 'resource_id' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tags */}
              {resource.tags && resource.tags.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                  <h3 className="text-sm font-semibold text-parchment mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {resource.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-ember/10 px-3 py-1 text-xs text-ember border border-ember/20"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
