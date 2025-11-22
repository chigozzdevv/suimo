import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/services/api';
import type { Wallet } from '@/services/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Modal } from '@/components/ui/modal';
import { Wallet as WalletIcon, TrendingDown, Plus, ArrowUpRight, Loader2, Copy, Check, Globe } from 'lucide-react';

export function WalletPage() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawStatus, setWithdrawStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const network = (import.meta.env.VITE_WALRUS_NETWORK === 'mainnet' ? 'Mainnet' : 'Testnet') as 'Mainnet' | 'Testnet'
  const [pinStatus, setPinStatus] = useState<{ has_pin: boolean; locked_until?: string; remaining_attempts?: number } | null>(null)
  const [withdrawPin, setWithdrawPin] = useState('')
  const [setPinOpen, setSetPinOpen] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [confirmNewPin, setConfirmNewPin] = useState('')
  const [setPinStatusMsg, setSetPinStatusMsg] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [walUsd, setWalUsd] = useState<number | null>(null)

  useEffect(() => {
    loadWallets();
  }, []);

  const loadWallets = async () => {
    setIsLoading(true);
    try {
      const [data, prices] = await Promise.all([
        api.getWallets(),
        api.getPrices().catch(() => ({ wal_usd: null })),
      ]);
      setWallets(data);
      setWalUsd(typeof prices.wal_usd === 'number' ? prices.wal_usd : null);
    } catch (err: any) {
      setError(err.message || 'Failed to load wallets');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (value?: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopyToast('copied');
      setTimeout(() => setCopyToast(null), 2000);
    } catch (err) {
      setCopyToast('Unable to copy');
      setTimeout(() => setCopyToast(null), 2000);
    }
  };

  const handleWithdraw = async () => {
    setWithdrawStatus(null);
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0) {
      setWithdrawStatus({ tone: 'error', message: 'Enter a valid amount greater than 0.' });
      return;
    }
    if (!withdrawAddress || withdrawAddress.length < 10) {
      setWithdrawStatus({ tone: 'error', message: 'Destination address is required.' });
      return;
    }
    if (pinStatus?.has_pin) {
      if (!withdrawPin) { setWithdrawStatus({ tone: 'error', message: 'Enter your withdrawal PIN.' }); return; }
      if (pinStatus.locked_until && new Date(pinStatus.locked_until).getTime() > Date.now()) { setWithdrawStatus({ tone: 'error', message: 'PIN is temporarily locked. Try again later.' }); return; }
    }
    setWithdrawSubmitting(true);
    try {
      const res = await api.createWithdrawal('payout', amount, withdrawAddress.trim(), pinStatus?.has_pin ? withdrawPin : undefined);
      setWithdrawStatus({ tone: 'success', message: `Withdrawal ${res.id} sent. Check ${withdrawAddress.trim()} after a few seconds.` });
      setWithdrawAmount('');
      setWithdrawAddress('');
      setWithdrawPin('');
      await loadWallets();
    } catch (err: any) {
      const msg = String(err?.message || '')
      const friendly =
        msg.includes('PIN_REQUIRED') ? 'Withdrawal PIN is required.' :
          msg.includes('PIN_INVALID') ? 'Invalid PIN. Please try again.' :
            msg.includes('PIN_LOCKED') ? 'Too many attempts. PIN is locked temporarily.' :
              msg.includes('PIN_NOT_SET') ? 'Please set a withdrawal PIN to continue.' :
                (err?.message || 'Unable to create withdrawal')
      setWithdrawStatus({ tone: 'error', message: friendly });
      try { const st = await api.getPinStatus(); setPinStatus(st) } catch { }
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="text-fog">Loading wallet...</div>;
  }

  if (error) {
    return <div className="text-ember">{error}</div>;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatToken = (amount: number, decimals: number = 3) => {
    if (amount === undefined || amount === null) return '0';
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: decimals }).format(amount);
  };

  const payerWallet = wallets.find((w) => w.role === 'payer');
  const payoutWallet = wallets.find((w) => w.role === 'payout');

  const walletPieData = [
    { name: 'Available', value: payerWallet?.available || 0 },
    { name: 'Blocked', value: payerWallet?.blocked || 0 },
  ];

  const COLORS = ['#D8C8A8', '#E07555'];
  const MAX_REQUEST_AMOUNT = 5000;

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-xs text-fog">
          <Globe className="h-3.5 w-3.5" />
          <span>Network:</span>
          <span className={`rounded-full px-2 py-0.5 ${network === 'Testnet' ? 'bg-white/10 text-parchment' : 'bg-white/5 text-parchment'}`}>{network}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-fog mb-1">Payer Wallet</p>
                    <div className="flex flex-col gap-1">
                      <div className="text-parchment">
                        <span className="text-fog mr-2">SUI</span>{formatToken(payerWallet?.onchain?.sui || 0, 3)}
                        {walUsd && payerWallet?.onchain?.sui && (
                          <span className="ml-2 text-xs text-fog">≈ ${(payerWallet.onchain.sui * 0.5).toFixed(2)}</span>
                        )}
                      </div>
                      <div className="text-parchment">
                        <span className="text-fog mr-2">WAL</span>{formatToken(payerWallet?.onchain?.wal || 0, 4)}
                        {walUsd && payerWallet?.onchain?.wal && (
                          <span className="ml-2 text-xs text-fog">≈ ${(payerWallet.onchain.wal * walUsd).toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center text-green-400">
                    <WalletIcon className="w-6 h-6" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-fog">Available (USD)</span>
                    <span className="text-parchment font-medium">
                      {formatCurrency(payerWallet?.available || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-fog">Blocked (USD)</span>
                    <span className="text-ember font-medium">
                      {formatCurrency(payerWallet?.blocked || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-white/10">
                    <span className="text-fog">Status</span>
                    <span className={`font-medium ${payerWallet?.status === 'active' ? 'text-parchment' : 'text-ember'}`}>
                      {payerWallet?.status || 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="primary" className="flex-1 gap-2" onClick={() => setDepositOpen(true)}>
                    <Plus className="w-4 h-4" />
                    Add Funds
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-fog mb-1">Payout Wallet</p>
                    <div className="flex flex-col gap-1">
                      <div className="text-parchment">
                        <span className="text-fog mr-2">SUI</span>{formatToken(payoutWallet?.onchain?.sui || 0, 3)}
                        {walUsd && payoutWallet?.onchain?.sui && (
                          <span className="ml-2 text-xs text-fog">≈ ${(payoutWallet.onchain.sui * 0.5).toFixed(2)}</span>
                        )}
                      </div>
                      <div className="text-parchment">
                        <span className="text-fog mr-2">WAL</span>{formatToken(payoutWallet?.onchain?.wal || 0, 4)}
                        {walUsd && payoutWallet?.onchain?.wal && (
                          <span className="ml-2 text-xs text-fog">≈ ${(payoutWallet.onchain.wal * walUsd).toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center text-amber-400">
                    <TrendingDown className="w-6 h-6" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-fog">Available (USD)</span>
                    <span className="text-parchment font-medium">
                      {formatCurrency(payoutWallet?.available || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-fog">Blocked (USD)</span>
                    <span className="text-fog font-medium">
                      {formatCurrency(payoutWallet?.blocked || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-white/10">
                    <span className="text-fog">Status</span>
                    <span className={`font-medium ${payoutWallet?.status === 'active' ? 'text-parchment' : 'text-ember'}`}>
                      {payoutWallet?.status || 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1 gap-2" onClick={async () => { setWithdrawOpen(true); try { const st = await api.getPinStatus(); setPinStatus(st); } catch { } }}>
                    <ArrowUpRight className="w-4 h-4" />
                    Withdraw
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-medium text-parchment mb-6">Wallet Balance Distribution</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={walletPieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {walletPieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111111',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#E6E2DC',
                    }}
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-white/40" />
                  <span className="text-sm text-fog">Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-ember" />
                  <span className="text-sm text-fog">Blocked</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Modal open={depositOpen} title="Add funds" onClose={() => setDepositOpen(false)}>
        <div className="space-y-4">
          <p className="text-sm text-parchment font-medium">Fund your wallets on {network}</p>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 text-xs uppercase tracking-wider text-fog/70">Your Payer Wallet Address</div>
            <div className="flex items-center gap-2">
              <p className="flex-1 break-all font-mono text-sm text-parchment">{payerWallet?.address || 'Address unavailable'}</p>
              <button
                onClick={() => handleCopy(payerWallet?.address)}
                className="shrink-0 flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs text-parchment transition hover:bg-white/10"
              >
                {copyToast === 'copied' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copyToast === 'copied' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-medium text-parchment mb-3">Steps to fund:</p>
            <ol className="space-y-3 text-sm text-parchment/90">
              <li className="flex gap-3">
                <span className="shrink-0 font-bold">1.</span>
                <span>Get SUI for gas: <a href="https://faucet.sui.io" target="_blank" rel="noopener noreferrer" className="underline hover:text-parchment font-medium">faucet.sui.io</a></span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 font-bold">2.</span>
                <span>Select <strong>Sui {network}</strong></span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 font-bold">3.</span>
                <span>Paste your wallet address from above</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 font-bold">4.</span>
                <span>
                  Get WAL on testnet: <a href="https://stakely.io/faucet/walrus-testnet-wal" target="_blank" rel="noopener noreferrer" className="underline hover:text-parchment font-medium">Stakely WAL faucet</a>
                </span>
              </li>
            </ol>
          </div>

          <p className="text-xs text-fog/70">Balances update after confirmation (~1 minute)</p>

          {copyToast && (
            <p className="text-xs text-parchment">
              {copyToast === 'copied' ? 'Address copied to clipboard' : copyToast}
            </p>
          )}
        </div>
      </Modal>

      <Modal open={withdrawOpen} title="Withdraw funds" onClose={() => { setWithdrawOpen(false); setWithdrawStatus(null); setWithdrawPin(''); }}>
        <div className="space-y-4">
          <p className="text-sm text-fog">
            Send payout wallet funds to a SUI address (testnet). You can request up to ${MAX_REQUEST_AMOUNT.toLocaleString()} per withdrawal.
          </p>
          <label className="space-y-1 text-sm text-fog">
            <span>Amount (USD)</span>
            <input
              type="number"
              min="1"
              max={MAX_REQUEST_AMOUNT}
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-parchment focus:border-white/40 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm text-fog">
            <span>Destination address</span>
            <input
              value={withdrawAddress}
              onChange={(e) => setWithdrawAddress(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-parchment focus:border-white/40 focus:outline-none"
              placeholder="Enter SUI address"
            />
          </label>
          {pinStatus?.has_pin ? (
            <label className="space-y-1 text-sm text-fog">
              <span>Withdrawal PIN</span>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={withdrawPin}
                onChange={(e) => setWithdrawPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-parchment focus:border-white/40 focus:outline-none"
                placeholder="Enter 4–6 digit PIN"
              />
              {pinStatus?.locked_until && new Date(pinStatus.locked_until).getTime() > Date.now() && (
                <div className="text-xs text-ember">PIN locked until {new Date(pinStatus.locked_until).toLocaleTimeString()}</div>
              )}
            </label>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-fog">
              <div className="flex items-center justify-between gap-2">
                <span>No withdrawal PIN set</span>
                <Button variant="outline" className="h-8 border-white/20" onClick={() => setSetPinOpen(true)}>Create PIN</Button>
              </div>
            </div>
          )}
          <Button onClick={handleWithdraw} disabled={withdrawSubmitting} className="mt-3 w-full">
            {withdrawSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit withdrawal'}
          </Button>
          {withdrawStatus && (
            <div
              className={`mt-3 rounded-xl border px-4 py-3 text-sm ${withdrawStatus.tone === 'success' ? 'border-white/30 bg-white/10 text-parchment' : 'border-ember/40 bg-ember/10 text-ember'
                }`}
            >
              {withdrawStatus.message}
            </div>
          )}
        </div>
      </Modal>

      <Modal open={setPinOpen} title="Create withdrawal PIN" onClose={() => { setSetPinOpen(false); setNewPin(''); setConfirmNewPin(''); setSetPinStatusMsg(null); }}>
        <div className="space-y-3">
          <p className="text-sm text-fog">Set a 4–6 digit PIN to authorize withdrawals.</p>
          <label className="space-y-1 text-sm text-fog">
            <span>New PIN</span>
            <input type="password" inputMode="numeric" pattern="[0-9]*" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-parchment" />
          </label>
          <label className="space-y-1 text-sm text-fog">
            <span>Confirm PIN</span>
            <input type="password" inputMode="numeric" pattern="[0-9]*" value={confirmNewPin} onChange={(e) => setConfirmNewPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-parchment" />
          </label>
          <Button
            onClick={async () => {
              setSetPinStatusMsg(null)
              if (newPin.length < 4 || newPin.length > 6) { setSetPinStatusMsg({ tone: 'error', message: 'PIN must be 4–6 digits' }); return }
              if (newPin !== confirmNewPin) { setSetPinStatusMsg({ tone: 'error', message: 'PINs do not match' }); return }
              try {
                await api.setPin(newPin)
                setSetPinStatusMsg({ tone: 'success', message: 'PIN set successfully' })
                setPinStatus({ has_pin: true })
                setTimeout(() => setSetPinOpen(false), 700)
              } catch (e: any) {
                setSetPinStatusMsg({ tone: 'error', message: e?.message || 'Unable to set PIN' })
              }
            }}
            className="w-full"
          >Save PIN</Button>
          {setPinStatusMsg && <div className={`rounded-xl border px-3 py-2 text-sm ${setPinStatusMsg.tone === 'success' ? 'border-sand/40 bg-sand/10 text-sand' : 'border-ember/40 bg-ember/10 text-ember'}`}>{setPinStatusMsg.message}</div>}
        </div>
      </Modal>
    </>
  );
}
