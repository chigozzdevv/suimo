import { fetchTokenPrices } from "@/features/prices/prices.service.js";
import { client, resolveWalCoinType, resolveWalDecimals } from "@/services/sui/sui.service.js";

/**
 * Calculate WAL amount needed for a USD price using current CoinGecko rates
 */
export async function calculateWalAmount(usdPrice: number): Promise<{
    walAmount: number;
    walUsdRate: number;
}> {
    const prices = await fetchTokenPrices();

    if (!prices.wal_usd || prices.wal_usd <= 0) {
        throw new Error("WAL_PRICE_UNAVAILABLE");
    }

    const walAmount = Number((usdPrice / prices.wal_usd).toFixed(6));

    return {
        walAmount,
        walUsdRate: prices.wal_usd,
    };
}

/**
 * Verify that a WAL payment was received on-chain
 */

export async function verifyWalPayment(params: {
    txDigest: string;
    expectedAmountWal: number;
    senderAddress: string;
    platformAddress: string;
}): Promise<boolean> {
    const { txDigest, expectedAmountWal, senderAddress, platformAddress } = params;

    const suiClient = client();

    try {
        const tx = await suiClient.getTransactionBlock({
            digest: txDigest,
            options: {
                showInput: true,
                showEffects: true,
                showBalanceChanges: true,
            },
        });

        if (!tx.effects?.status?.status || tx.effects.status.status !== "success") {
            return false;
        }

        const balanceChanges = tx.balanceChanges || [];
        const walCoinType = resolveWalCoinType();
        const decimals = resolveWalDecimals();

        const senderChange = balanceChanges.find(
            (bc) => bc.owner === senderAddress && bc.coinType === walCoinType
        );

        const platformChange = balanceChanges.find(
            (bc) => bc.owner === platformAddress && bc.coinType === walCoinType
        );

        if (!senderChange || !platformChange) {
            return false;
        }

        const senderAmount = Math.abs(Number(senderChange.amount)) / Math.pow(10, decimals);
        const platformAmount = Math.abs(Number(platformChange.amount)) / Math.pow(10, decimals);

        // Verify amounts match expected (with small tolerance for rounding)
        const tolerance = 0.000001;
        return (
            Math.abs(senderAmount - expectedAmountWal) < tolerance &&
            Math.abs(platformAmount - expectedAmountWal) < tolerance
        );
    } catch (error) {
        console.error("[WalPayment] Verification failed:", error);
        return false;
    }
}
