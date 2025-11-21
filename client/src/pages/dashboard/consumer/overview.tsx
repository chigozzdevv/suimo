import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Wallet, Lock, Gauge } from 'lucide-react'
import { api, type ConsumerActivityItem, type TopAgentStat, type TopSourceStat } from '@/services/api'

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

function formatCurrency(value?: number) {
  return currencyFormatter.format(value ?? 0)
}

function formatTimestamp(ts?: string) {
  if (!ts) return '—'
  try {
    return dateFormatter.format(new Date(ts))
  } catch {
    return ts
  }
}

export function ConsumerOverview() {
  const [walletStats, setWalletStats] = useState({ available: 0, blocked: 0, weeklyCap: 0 })
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)

  const [activity, setActivity] = useState<ConsumerActivityItem[]>([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [activityError, setActivityError] = useState<string | null>(null)

  const [topAgents, setTopAgents] = useState<TopAgentStat[]>([])
  const [agentsLoading, setAgentsLoading] = useState(true)
  const [agentsError, setAgentsError] = useState<string | null>(null)

  const [topSources, setTopSources] = useState<TopSourceStat[]>([])
  const [sourcesLoading, setSourcesLoading] = useState(true)
  const [sourcesError, setSourcesError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadStats() {
      setStatsLoading(true)
      setStatsError(null)
      try {
        const [wallets, caps] = await Promise.all([
          api.getWallets(),
          api.getSpendingCaps().catch(() => null),
        ])
        if (cancelled) return
        const payer = wallets.find((wallet) => wallet.role === 'payer')
        setWalletStats({
          available: payer?.onchain?.wal ?? 0,
          blocked: payer?.blocked ?? 0,
          weeklyCap: caps?.global_weekly_cap ?? 0,
        })
      } catch (err: any) {
        if (!cancelled) setStatsError(err.message || 'Unable to load balances')
      } finally {
        if (!cancelled) setStatsLoading(false)
      }
    }

    async function loadActivity() {
      setActivityLoading(true)
      setActivityError(null)
      try {
        const items = await api.getConsumerActivity(5)
        if (!cancelled) setActivity(items)
      } catch (err: any) {
        if (!cancelled) setActivityError(err.message || 'Unable to load activity')
      } finally {
        if (!cancelled) setActivityLoading(false)
      }
    }

    async function loadAgents() {
      setAgentsLoading(true)
      setAgentsError(null)
      try {
        const items = await api.getConsumerTopAgents(5)
        if (!cancelled) setTopAgents(items)
      } catch (err: any) {
        if (!cancelled) setAgentsError(err.message || 'Unable to load agents')
      } finally {
        if (!cancelled) setAgentsLoading(false)
      }
    }

    async function loadSources() {
      setSourcesLoading(true)
      setSourcesError(null)
      try {
        const items = await api.getConsumerTopSources(5)
        if (!cancelled) setTopSources(items)
      } catch (err: any) {
        if (!cancelled) setSourcesError(err.message || 'Unable to load sources')
      } finally {
        if (!cancelled) setSourcesLoading(false)
      }
    }

    loadStats()
    loadActivity()
    loadAgents()
    loadSources()

    return () => {
      cancelled = true
    }
  }, [])

  const statCards = [
    { icon: Wallet, color: 'text-green-400', label: 'Wallet balance', helper: 'Payer wallet', value: statsError ? '—' : formatCurrency(walletStats.available) },
    { icon: Lock, color: 'text-amber-400', label: 'Blocked funds', helper: 'Held for crawls', value: statsError ? '—' : formatCurrency(walletStats.blocked) },
    { icon: Gauge, color: 'text-blue-400', label: 'Weekly cap', helper: 'Global spending', value: statsError ? '—' : walletStats.weeklyCap ? formatCurrency(walletStats.weeklyCap) : '—' },
  ]

  const renderListState = (loading: boolean, error: string | null, empty: boolean) => {
    if (loading) return <p className="text-sm text-fog">Loading…</p>
    if (error) return <p className="text-sm text-ember">{error}</p>
    if (empty) return <p className="text-sm text-fog">No data yet.</p>
    return null
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((item) => (
          <StatsCard
            key={item.label}
            icon={item.icon}
            color={item.color}
            label={item.label}
            value={statsLoading ? 'Loading…' : item.value}
            helper={item.helper}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-4 p-6">
            <div>
              <p className="text-sm font-semibold text-parchment">Recent activity</p>
              <p className="text-xs text-fog">Latest crawl payments and statuses.</p>
            </div>
            {renderListState(activityLoading, activityError, activity.length === 0) || (
              <ul className="space-y-3">
                {activity.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-4 rounded-xl border border-white/5 bg-white/5 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-parchment">{item.resource_title || 'Untitled resource'}</p>
                      <p className="text-xs text-fog">
                        {(item.resource_domain || 'Direct crawl') + ' • ' + (item.mode ? item.mode.toUpperCase() : 'RAW')}
                      </p>
                      <p className="text-xs text-fog/70">{formatTimestamp(item.ts)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-parchment">{formatCurrency(item.cost)}</p>
                      <p className={`text-xs uppercase ${item.status === 'settled' ? 'text-parchment' : 'text-fog'}`}>{item.status || 'pending'}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-6">
              <div>
                <p className="text-sm font-semibold text-parchment">Top agents</p>
                <p className="text-xs text-fog">Most frequently used crawlers.</p>
              </div>
              {renderListState(agentsLoading, agentsError, topAgents.length === 0) || (
                <ul className="space-y-3">
                  {topAgents.map((agent) => (
                    <li key={agent.agent_id || agent.agent_name} className="flex items-center justify-between rounded-xl border border-white/5 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-parchment">{agent.agent_name}</p>
                        <p className="text-xs text-fog">{numberFormatter.format(agent.count)} runs</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-4 p-6">
              <div>
                <p className="text-sm font-semibold text-parchment">Most used sources</p>
                <p className="text-xs text-fog">Where spend is concentrated.</p>
              </div>
              {renderListState(sourcesLoading, sourcesError, topSources.length === 0) || (
                <ul className="space-y-3">
                  {topSources.map((source) => (
                    <li key={source.resource_id || source.resource_title} className="flex items-center justify-between rounded-xl border border-white/5 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-parchment">{source.resource_title || 'Resource'}</p>
                        <p className="text-xs text-fog">{source.resource_domain || 'Private source'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-parchment">{numberFormatter.format(source.count)} runs</p>
                        <p className="text-xs text-fog">{formatCurrency(source.spent)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  )
}

function StatsCard({ icon: Icon, color, label, value, helper }: { icon: any; color: string; label: string; value: string; helper: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-2 flex items-start justify-between">
          <div className={`w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="text-2xl font-semibold text-parchment">{value}</div>
        <div className="text-sm text-fog">{label}</div>
        <div className="text-xs text-fog mt-1">{helper}</div>
      </CardContent>
    </Card>
  )
}
