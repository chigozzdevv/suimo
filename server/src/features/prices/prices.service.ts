import { loadEnv } from "@/config/env.js";

interface PriceCache {
    sui_usd: number | null;
    wal_usd: number | null;
    lastUpdated: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

let cache: PriceCache = {
    sui_usd: null,
    wal_usd: null,
    lastUpdated: 0,
};

async function fetchFromMobula(): Promise<{ sui_usd: number | null; wal_usd: number | null }> {
    try {
        const [suiResponse, walResponse] = await Promise.all([
            fetch("https://api.mobula.io/api/1/market/data?asset=sui", { signal: AbortSignal.timeout(5000) }),
            fetch("https://api.mobula.io/api/1/market/data?asset=walrus", { signal: AbortSignal.timeout(5000) })
        ]);

        let sui_usd: number | null = null;
        let wal_usd: number | null = null;

        if (suiResponse.ok) {
            const data = await suiResponse.json();
            sui_usd = data?.data?.price || null;
            if (sui_usd) console.log(`[PriceService] Mobula: SUI=$${sui_usd}`);
        } else {
            console.warn(`[PriceService] Mobula SUI error: ${suiResponse.status}`);
        }

        if (walResponse.ok) {
            const data = await walResponse.json();
            wal_usd = data?.data?.price || null;
            if (wal_usd) console.log(`[PriceService] Mobula: WAL=$${wal_usd}`);
        } else {
            console.warn(`[PriceService] Mobula WAL error: ${walResponse.status}`);
        }

        return { sui_usd, wal_usd };
    } catch (error) {
        console.warn("[PriceService] Mobula failed:", error);
        return { sui_usd: null, wal_usd: null };
    }
}

async function fetchFromCoinGecko(): Promise<{
    sui_usd: number | null;
    wal_usd: number | null;
}> {
    try {
        const response = await fetch(
            "https://api.coingecko.com/api/v3/simple/price?ids=sui,walrus-2&vs_currencies=usd",
            { signal: AbortSignal.timeout(5000) }
        );

        if (response.status === 429) {
            console.warn("[PriceService] CoinGecko rate limited");
            return { sui_usd: null, wal_usd: null };
        }

        if (!response.ok) {
            console.warn(`[PriceService] CoinGecko error: ${response.status}`);
            return { sui_usd: null, wal_usd: null };
        }

        const data = await response.json();
        const sui_usd = data.sui?.usd ?? null;
        const wal_usd = data["walrus-2"]?.usd ?? null;

        if (sui_usd || wal_usd) {
            console.log(`[PriceService] CoinGecko: SUI=$${sui_usd}, WAL=$${wal_usd}`);
        }

        return { sui_usd, wal_usd };
    } catch (error) {
        console.warn("[PriceService] CoinGecko failed:", error);
        return { sui_usd: null, wal_usd: null };
    }
}

export async function fetchTokenPrices(): Promise<{
    sui_usd: number | null;
    wal_usd: number | null;
}> {
    const now = Date.now();

    if (cache.lastUpdated && now - cache.lastUpdated < CACHE_TTL) {
        return { sui_usd: cache.sui_usd, wal_usd: cache.wal_usd };
    }

    let sui_usd: number | null = null;
    let wal_usd: number | null = null;

    const mobulaResult = await fetchFromMobula();
    if (mobulaResult.sui_usd) sui_usd = mobulaResult.sui_usd;
    if (mobulaResult.wal_usd) wal_usd = mobulaResult.wal_usd;

    // 2. Fallback to CoinGecko if needed
    if (!sui_usd || !wal_usd) {
        const coinGeckoResult = await fetchFromCoinGecko();
        if (!sui_usd && coinGeckoResult.sui_usd) sui_usd = coinGeckoResult.sui_usd;
        if (!wal_usd && coinGeckoResult.wal_usd) wal_usd = coinGeckoResult.wal_usd;
    }

    if (sui_usd !== null || wal_usd !== null) {
        cache = {
            sui_usd: sui_usd ?? cache.sui_usd,
            wal_usd: wal_usd ?? cache.wal_usd,
            lastUpdated: now,
        };
        console.log(`[PriceService] Updated: SUI=$${cache.sui_usd}, WAL=$${cache.wal_usd}`);
    } else {
        console.error("[PriceService] All sources failed, using stale cache");
    }

    return { sui_usd: cache.sui_usd, wal_usd: cache.wal_usd };
}
