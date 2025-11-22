import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api, type CatalogResource } from "@/services/api";
import {
  Search,
  FileText,
  Database,
  Shield,
  TrendingUp,
  ChevronDown,
  Check,
  ArrowLeft,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export function MarketsPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CatalogResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [walUsd, setWalUsd] = useState<number | null>(null);
  const debounceRef = useRef<number | null>(null);

  const priceRanges = [
    { label: "All Prices", value: "", min: 0, max: Infinity },
    { label: "Under $10", value: "under-10", min: 0, max: 10 },
    { label: "$10 - $50", value: "10-50", min: 10, max: 50 },
    { label: "$50 - $100", value: "50-100", min: 50, max: 100 },
    { label: "$100+", value: "100-plus", min: 100, max: Infinity },
  ];

  const fetchData = async (opts?: { category?: string; q?: string }) => {
    setLoading(true);
    try {
      const [cats, res, prices] = await Promise.all([
        categories.length
          ? Promise.resolve(categories)
          : api.getMarketCategories(),
        api.getCatalogResources({
          limit: 100,
          category: opts?.category,
          q: opts?.q,
        }),
        api.getPrices().catch(() => ({ wal_usd: null })),
      ]);
      if (!categories.length) setCategories(cats);
      setItems(res);
      setWalUsd(typeof prices.wal_usd === "number" ? prices.wal_usd : null);
      setError("");
    } catch (e: any) {
      setError(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData({});
  }, []);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      fetchData({
        category: selectedCategory || undefined,
        q: query || undefined,
      });
    }, 400) as unknown as number;
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [selectedCategory, query]);

  const filteredAndSortedItems = items.filter((item) => {
    if (selectedPriceRange) {
      const range = priceRanges.find((r) => r.value === selectedPriceRange);
      if (range && item.price_flat) {
        if (item.price_flat < range.min || item.price_flat > range.max)
          return false;
      }
    }
    return true;
  });

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="min-h-screen bg-ink text-parchment">
      <div className="bg-gradient-to-b from-ember/10 via-ember/5 to-ink border-b border-white/5">
        <div className="mx-auto max-w-7xl px-4 pt-8 pb-6 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => navigate("/")}
                className="flex items-center gap-2 text-fog hover:text-parchment transition-colors group"
              >
                <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
                <span className="text-sm font-medium">Home</span>
              </button>
              <div className="h-6 w-px bg-white/20" />
              <h1 className="text-3xl font-bold md:text-4xl text-parchment">
                Data Markets
              </h1>
            </div>

            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fog" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search resources..."
                  className="w-full rounded-lg border border-white/20 bg-white/10 py-2.5 pl-10 pr-4 text-sm text-parchment placeholder:text-fog/70 focus:border-ember/50 focus:outline-none transition-colors"
                />
              </div>

              <div className="flex gap-2">
                <div className="relative">
                  <button
                    onClick={(e) => {
                      const dropdown = e.currentTarget
                        .nextElementSibling as HTMLElement;
                      dropdown?.classList.toggle("hidden");
                    }}
                    className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-parchment hover:bg-white/15 transition-colors whitespace-nowrap"
                  >
                    <span className="font-medium">
                      {selectedCategory || "Category"}
                    </span>
                    <ChevronDown className="h-4 w-4 text-fog" />
                  </button>
                  <div className="hidden absolute right-0 z-20 mt-2 w-48 rounded-xl border border-white/10 bg-[#0a0a0a]/98 backdrop-blur-xl p-1.5 shadow-2xl">
                    <button
                      onClick={() => {
                        setSelectedCategory("");
                        document
                          .querySelectorAll(".hidden")
                          .forEach((el) => el.classList.add("hidden"));
                      }}
                      className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${!selectedCategory ? "bg-ember/20 text-parchment font-medium" : "text-fog hover:bg-white/5 hover:text-parchment"}`}
                    >
                      <span>All Categories</span>
                      {!selectedCategory && <Check className="h-4 w-4" />}
                    </button>
                    {categories.map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          setSelectedCategory(c);
                          document
                            .querySelectorAll(".hidden")
                            .forEach((el) => el.classList.add("hidden"));
                        }}
                        className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${selectedCategory === c ? "bg-ember/20 text-parchment font-medium" : "text-fog hover:bg-white/5 hover:text-parchment"}`}
                      >
                        <span>{c}</span>
                        {selectedCategory === c && (
                          <Check className="h-4 w-4" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <button
                    onClick={(e) => {
                      const dropdown = e.currentTarget
                        .nextElementSibling as HTMLElement;
                      dropdown?.classList.toggle("hidden");
                    }}
                    className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-parchment hover:bg-white/15 transition-colors whitespace-nowrap"
                  >
                    <span className="font-medium">
                      {priceRanges.find((r) => r.value === selectedPriceRange)
                        ?.label || "Price"}
                    </span>
                    <ChevronDown className="h-4 w-4 text-fog" />
                  </button>
                  <div className="hidden absolute right-0 z-20 mt-2 w-40 rounded-xl border border-white/10 bg-[#0a0a0a]/98 backdrop-blur-xl p-1.5 shadow-2xl">
                    {priceRanges.map((range) => (
                      <button
                        key={range.value}
                        onClick={() => {
                          setSelectedPriceRange(range.value);
                          document
                            .querySelectorAll(".hidden")
                            .forEach((el) => el.classList.add("hidden"));
                        }}
                        className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${selectedPriceRange === range.value ? "bg-ember/20 text-parchment font-medium" : "text-fog hover:bg-white/5 hover:text-parchment"}`}
                      >
                        <span>{range.label}</span>
                        {selectedPriceRange === range.value && (
                          <Check className="h-4 w-4" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="flex items-center justify-between mb-5">
          <div className="text-sm text-fog font-medium">
            {!loading && <span>{filteredAndSortedItems.length} resources</span>}
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-ember" />
              <div className="text-fog">Loading marketplace...</div>
            </div>
          </div>
        )}
        {error && !loading && (
          <div className="rounded-2xl border border-ember/50 bg-ember/10 p-6 text-center">
            <div className="text-ember font-medium">{error}</div>
          </div>
        )}
        {!loading && !error && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAndSortedItems.length === 0 && (
              <div className="col-span-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-12 text-center">
                <Database className="h-12 w-12 text-fog/50 mx-auto mb-4" />
                <div className="text-fog text-lg">No resources found</div>
                <div className="text-fog/70 text-sm mt-2">
                  Try adjusting your search or filters
                </div>
              </div>
            )}
            {filteredAndSortedItems.map((r, i) => (
              <motion.button
                key={r._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, type: "spring", stiffness: 100 }}
                className="group relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent backdrop-blur-sm p-6 text-left transition-all hover:border-ember/50 hover:shadow-2xl hover:shadow-ember/10 hover:-translate-y-1"
                onClick={() =>
                  navigate(`/markets/${encodeURIComponent(r._id)}`)
                }
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-ember/0 to-ember/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="relative">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 flex-shrink-0 flex items-center justify-center rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 group-hover:border-ember/30 transition-colors">
                        {r.image_url ? (
                          <img
                            src={r.image_url}
                            alt={r.title}
                            className="h-full w-full object-cover rounded-xl"
                          />
                        ) : (
                          <FileText className="h-6 w-6 text-parchment/70" />
                        )}
                      </div>
                      {r.verified && (
                        <div className="flex items-center gap-1.5 rounded-full bg-green-400/10 px-2.5 py-1 border border-green-400/20">
                          <Shield className="h-3 w-3 text-green-400" />
                          <span className="text-xs text-green-400 font-medium">
                            Verified
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-parchment mb-2 line-clamp-1 group-hover:text-ember transition-colors">
                    {r.title}
                  </h3>

                  {(r.sample_preview || r.summary) && (
                    <p className="text-sm text-fog/80 line-clamp-2 mb-4">
                      {r.sample_preview || r.summary}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1 text-xs text-fog border border-white/10">
                      <Database className="h-3 w-3" />
                      {r.type}
                    </span>
                    {r.format && (
                      <span className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-fog border border-white/10 uppercase">
                        {r.format}
                      </span>
                    )}
                    {r.size_bytes && (
                      <span className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-fog border border-white/10">
                        {formatSize(r.size_bytes)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <div>
                      {typeof r.price_flat === "number" && (
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-ember" />
                          <div>
                            <div className="text-parchment font-semibold">
                              {walUsd
                                ? `${(r.price_flat / walUsd).toFixed(4)} WAL`
                                : `$${r.price_flat.toFixed(2)}`}
                            </div>
                            {walUsd && (
                              <div className="text-xs text-fog">
                                ${r.price_flat.toFixed(2)} USD
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {typeof r.price_per_kb === "number" && (
                        <div className="text-xs text-fog mt-1">
                          {walUsd
                            ? `${(r.price_per_kb / walUsd).toFixed(6)} WAL/KB`
                            : `$${r.price_per_kb.toFixed(4)}/KB`}
                        </div>
                      )}
                    </div>
                    <div className="h-9 w-9 flex items-center justify-center rounded-full bg-ember/10 border border-ember/20 group-hover:bg-ember group-hover:border-ember transition-all">
                      <svg
                        className="h-4 w-4 text-ember group-hover:text-parchment transition-colors"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
