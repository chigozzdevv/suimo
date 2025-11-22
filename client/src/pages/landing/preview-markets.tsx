import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileText } from "lucide-react";
import { api } from "@/services/api";
import type { CatalogResource } from "@/services/api";

export function PreviewMarkets() {
  const [items, setItems] = useState<CatalogResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [walUsd, setWalUsd] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [data, prices] = await Promise.all([
          api.getCatalogResources(),
          api.getPrices().catch(() => ({ wal_usd: null })),
        ]);
        setItems(data.slice(0, 6));
        setWalUsd(typeof prices.wal_usd === "number" ? prices.wal_usd : null);
      } catch (err: any) {
        setError(err.message || "Failed to load preview");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <section>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <h2 className="text-3xl font-medium tracking-tight md:text-4xl">
          Data Marketplace
        </h2>
        <p className="mt-3 text-base text-fog md:text-lg">
          Browse and access real-time, priced data resources
        </p>
      </motion.div>

      {loading && <div className="mt-8 text-fog">Loading…</div>}
      {error && !loading && <div className="mt-8 text-ember">{error}</div>}
      {!loading && !error && (
        <>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((resource, i) => (
              <motion.div
                key={resource._id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.05 }}
                className="group cursor-pointer rounded-2xl border border-white/10 bg-transparent p-6 transition-all hover:border-white/30 hover:bg-white/5 flex flex-col"
                onClick={() =>
                  (window.location.href = `/markets/${resource._id}`)
                }
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-parchment">
                    <FileText className="h-6 w-6" />
                  </div>
                  {resource.verified && (
                    <span className="rounded-full bg-green-400/10 px-2.5 py-1 text-xs text-green-400 font-medium">
                      Verified
                    </span>
                  )}
                </div>

                <h3 className="truncate text-lg text-parchment font-semibold mb-2">
                  {resource.title}
                </h3>

                {(resource.sample_preview || resource.summary) && (
                  <p className="text-sm text-fog/80 line-clamp-3 mb-4 flex-1">
                    {resource.sample_preview || resource.summary}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-fog uppercase border border-white/5">
                    {resource.type}
                  </span>
                  <span className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-fog uppercase border border-white/5">
                    {resource.format}
                  </span>
                  {resource.size_bytes && (
                    <span className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-fog border border-white/5">
                      {formatSize(resource.size_bytes)}
                    </span>
                  )}
                </div>

                <div className="mt-auto pt-4 border-t border-white/10 flex items-center justify-between">
                  <div className="text-sm">
                    {typeof resource.price_flat === "number" && (
                      <div className="font-medium text-parchment">
                        {walUsd
                          ? `${(resource.price_flat / walUsd).toFixed(4)} WAL`
                          : formatCurrency(resource.price_flat)}
                        {walUsd && (
                          <span className="text-xs text-fog ml-1">
                            (~{formatCurrency(resource.price_flat)})
                          </span>
                        )}
                      </div>
                    )}
                    {typeof resource.price_per_kb === "number" && (
                      <div className="text-xs text-fog">
                        {walUsd
                          ? `${(resource.price_per_kb / walUsd).toFixed(6)} WAL/KB`
                          : `${formatCurrency(resource.price_per_kb)}/KB`}
                      </div>
                    )}
                  </div>
                  <ExternalLink className="h-4 w-4 text-fog transition group-hover:text-parchment" />
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Button
              variant="outline"
              className="border-white/20 px-6"
              onClick={() => (window.location.href = "/markets")}
            >
              View All Resources
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
