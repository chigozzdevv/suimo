import { loadEnv } from "@/config/env.js";

interface PriceCache {
    sui_usd: number | null;
    wal_usd: number | null;
    lastUpdated: number;
}

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes - reduced API calls to avoid rate limiting
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

    const maxRetries = 2;
    let lastError: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(
                "https://api.coingecko.com/api/v3/simple/price?ids=sui,walrus-2&vs_currencies=usd",
                { signal: AbortSignal.timeout(5000) }
            );

            if (response.status === 429) {
                // Rate limited - wait before retry
                if (attempt < maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000; // 1s, 2s exponential backoff
                    console.warn(`[PriceService] Rate limited (429), retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                console.warn(`[PriceService] Rate limited after ${maxRetries} retries, using cache`);
                return { sui_usd: cache.sui_usd, wal_usd: cache.wal_usd };
            }

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
            lastError = error;
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000;
                console.warn(`[PriceService] Error on attempt ${attempt + 1}, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
        }
    }

    console.error("[PriceService] Error fetching prices after retries:", lastError);
    return { sui_usd: cache.sui_usd, wal_usd: cache.wal_usd };
}

