import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/services/api";
import type { EarningsData } from "@/services/api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { DollarSign, TrendingUp, Calendar, Activity } from "lucide-react";

export function EarningsPage() {
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [period, setPeriod] = useState<"30" | "90">("30");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadEarnings();
  }, [period]);

  const loadEarnings = async () => {
    setIsLoading(true);
    try {
      const days = period === "30" ? 30 : 90;
      const data = await api.getProviderEarnings(days);
      setEarnings(data);
    } catch (err: any) {
      setError(err.message || "Failed to load earnings");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="text-fog">Loading earnings...</div>;
  }

  if (error) {
    return <div className="text-ember">{error}</div>;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-medium text-parchment">
            Earnings Analytics
          </h2>
          <p className="text-sm text-fog mt-1">
            Track your revenue and performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPeriod("30")}
            className={`px-3 py-1 rounded-lg text-sm transition-colors ${
              period === "30"
                ? "bg-white/10 text-parchment"
                : "bg-white/5 text-fog hover:text-parchment"
            }`}
          >
            30 Days
          </button>
          <button
            onClick={() => setPeriod("90")}
            className={`px-3 py-1 rounded-lg text-sm transition-colors ${
              period === "90"
                ? "bg-white/10 text-parchment"
                : "bg-white/5 text-fog hover:text-parchment"
            }`}
          >
            90 Days
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-5">
              <div className="mb-3 flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-green-400">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-semibold text-parchment">
                {formatCurrency(earnings?.period_total || 0)}
              </div>
              <div className="text-sm text-fog">Period Total</div>
              <div className="text-xs text-fog mt-1">Last {period} days</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="p-5">
              <div className="mb-3 flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-purple-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-semibold text-parchment">
                {formatCurrency(earnings?.total || 0)}
              </div>
              <div className="text-sm text-fog">All Time</div>
              <div className="text-xs text-fog mt-1">Total earnings</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardContent className="p-5">
              <div className="mb-3 flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-amber-400">
                  <Activity className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-semibold text-parchment">
                {formatCurrency((earnings?.period_total || 0) / Number(period))}
              </div>
              <div className="text-sm text-fog">Avg Daily</div>
              <div className="text-xs text-fog mt-1">Last {period} days</div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-medium text-parchment">
                Earnings Over Time
              </h2>
              <Calendar className="w-5 h-5 text-fog" />
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={earnings?.daily || []}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D8C8A8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#D8C8A8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis
                  dataKey="date"
                  stroke="#B9B1A5"
                  tick={{ fill: "#B9B1A5", fontSize: 12 }}
                />
                <YAxis
                  stroke="#B9B1A5"
                  tick={{ fill: "#B9B1A5", fontSize: 12 }}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111111",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    color: "#E6E2DC",
                  }}
                  formatter={(value: any) => [
                    formatCurrency(value),
                    "Earnings",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#D8C8A8"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorAmount)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
