import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { WalletIcon, ArrowRight, Copy, Check, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

type SignupSuccessModalProps = {
  open: boolean
  onClose: () => void
}

export function SignupSuccessModal({ open, onClose }: SignupSuccessModalProps) {
  const navigate = useNavigate()
  const mcpUrl = 'https://api.suimo.com/mcp'
  const [copied, setCopied] = useState(false as any)
  const copy = async () => {
    try { await navigator.clipboard.writeText(mcpUrl); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4 backdrop-blur"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-md rounded-3xl border border-white/10 bg-ink p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sand/10">
                <WalletIcon className="h-8 w-8 text-sand" />
              </div>
              <h2 className="mb-2 text-2xl font-medium text-parchment">Welcome to Suimo!</h2>

              <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
                <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.3em] text-fog/70">
                  <span>MCP Endpoint</span>
                  <button onClick={copy} className="flex items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-parchment transition hover:bg-white/10">
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <a href={mcpUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all font-mono text-xs text-sand hover:text-parchment">
                  {mcpUrl} <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
                <p className="text-sm text-parchment font-medium">Quick start (testnet)</p>
                <ul className="mt-2 space-y-2 text-xs text-fog">
                  <li>• Get SUI for gas: <a href="https://faucet.sui.io" target="_blank" rel="noopener noreferrer" className="underline hover:text-parchment">faucet.sui.io</a></li>
                  <li>• Get WAL: <a href="https://stakely.io/faucet/walrus-testnet-wal" target="_blank" rel="noopener noreferrer" className="underline hover:text-parchment">Stakely WAL faucet</a></li>
                </ul>
              </div>

              <Button onClick={() => { onClose(); navigate('/app'); }} className="w-full bg-[#cfbea0] text-black hover:bg-[#cfbea0]">
                Proceed <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
