import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { findWalletKey } from "@/features/wallets/keys.model.js";
import { decryptSecret } from "@/services/crypto/keystore.js";
import { client, resolveWalCoinType, resolveWalDecimals } from "@/services/sui/sui.service.js";
import { Transaction } from "@mysten/sui/transactions";

function toAtomic(amountUi: string | number, decimals: number): bigint {
    const s = String(amountUi);
    const [ints, frac = ""] = s.split(".");
    const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
    const joined = `${ints}${fracPadded}`.replace(/^0+/, "") || "0";
    return BigInt(joined);
}

export async function transferWalFromUser(
    userId: string,
    toAddress: string,
    amountWal: number,
): Promise<string> {
    const walletKey = await findWalletKey(userId, "payer");
    if (!walletKey) {
        throw new Error("USER_WALLET_NOT_FOUND");
    }

    const secretKeyBytes = decryptSecret(walletKey.enc);
    const keypair = Ed25519Keypair.fromSecretKey(secretKeyBytes.slice(0, 32));

    const coinType = resolveWalCoinType();
    const decimals = resolveWalDecimals();
    const suiClient = client();
    const owner = keypair.getPublicKey().toSuiAddress();

    console.log(`[CustodialTransfer] Transferring from user: ${userId}`);
    console.log(`[CustodialTransfer] Sender Address: ${owner}`);
    console.log(`[CustodialTransfer] CoinType: ${coinType}`);
    console.log(`[CustodialTransfer] Decimals: ${decimals}`);

    const coins = await suiClient.getCoins({ owner, coinType, limit: 200 });
    const total = coins.data.reduce((acc, x) => acc + BigInt(x.balance), 0n);
    const need = toAtomic(amountWal, decimals);

    console.log(`[CustodialTransfer] Total Balance (Atomic): ${total}`);
    console.log(`[CustodialTransfer] Need (Atomic): ${need}`);
    console.log(`[CustodialTransfer] Coins found: ${coins.data.length}`);

    if (total < need) {
        console.error(`[CustodialTransfer] INSUFFICIENT_WAL_BALANCE. Total: ${total}, Need: ${need}`);
        throw new Error("INSUFFICIENT_WAL_BALANCE");
    }

    const tx = new Transaction();
    if (coins.data.length === 0) {
        throw new Error("NO_WAL_COINS");
    }

    let primary = tx.object(coins.data[0].coinObjectId);
    if (coins.data.length > 1) {
        const rest = coins.data.slice(1).map((c) => tx.object(c.coinObjectId));
        tx.mergeCoins(primary, rest);
    }

    const [pay] = tx.splitCoins(primary, [tx.pure.u64(Number(need))]);
    tx.transferObjects([pay], tx.pure.address(toAddress));
    tx.setGasBudget(5_000_000);

    const res = await suiClient.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx,
        options: { showEffects: true },
    });

    return res.digest;
}
