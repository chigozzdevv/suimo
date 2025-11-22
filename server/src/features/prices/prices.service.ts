import { loadEnv } from "@/config/env.js";

interface PriceCache {
    sui_usd: number | null;
    wal_usd: number | null;
    lastUpdated: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let cache: PriceCache = {
    sui_usd: null,
    wal_usd: null,
    lastUpdated: 0,
};

export async function fetchTokenPrices(): Promise<{
    sui_usd: number | null;
    wal_usd: number | null;
}> {
    const now = Date.now();

    if (cache.lastUpdated && now - cache.lastUpdated < CACHE_TTL) {
        return { sui_usd: cache.sui_usd, wal_usd: cache.wal_usd };
    }

    try {
        const response = await fetch(
            "https://api.coingecko.com/api/v3/simple/price?ids=sui,walrus-2&vs_currencies=usd",
            { signal: AbortSignal.timeout(5000) }
        );

        if (!response.ok) {
            console.warn(`[PriceService] CoinGecko API error: ${response.status}`);
            return { sui_usd: cache.sui_usd, wal_usd: cache.wal_usd };
        }

        const data = await response.json();

        cache = {
            sui_usd: data.sui?.usd ?? null,
            wal_usd: data["walrus-2"]?.usd ?? null,
            lastUpdated: now,
        };

        console.log(`[PriceService] Prices updated: SUI=$${cache.sui_usd}, WAL=$${cache.wal_usd}`);

        return { sui_usd: cache.sui_usd, wal_usd: cache.wal_usd };
    } catch (error) {
        console.error("[PriceService] Error fetching prices:", error);
        return { sui_usd: cache.sui_usd, wal_usd: cache.wal_usd };
    }
}
