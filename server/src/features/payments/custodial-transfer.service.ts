import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { findWalletKey } from "@/features/wallets/keys.model.js";
import { decryptSecret } from "@/services/crypto/keystore.js";
import { client, resolveWalCoinType, resolveWalDecimals } from "@/services/sui/sui.service.js";
import { Transaction } from "@mysten/sui/transactions";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";

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
    let keypair: Ed25519Keypair;
    const secretStr = secretKeyBytes.toString('utf8');

    if (secretStr.startsWith('suiprivkey')) {
        const { secretKey } = decodeSuiPrivateKey(secretStr);
        keypair = Ed25519Keypair.fromSecretKey(secretKey);
    } else {
        keypair = Ed25519Keypair.fromSecretKey(secretKeyBytes.slice(0, 32));
    }

    const coinType = resolveWalCoinType();
    const decimals = resolveWalDecimals();
    const suiClient = client();
    const owner = keypair.getPublicKey().toSuiAddress();

    const coins = await suiClient.getCoins({ owner, coinType, limit: 200 });
    const total = coins.data.reduce((acc, x) => acc + BigInt(x.balance), 0n);
    const need = toAtomic(amountWal, decimals);

    if (total < need) {
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
