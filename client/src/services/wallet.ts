import { getWallets } from "@mysten/wallet-standard";

export type WalletAdapterId = string;

type WalletMeta = {
  id: string;
  label: string;
  installUrl: string;
  adapter?: WalletAdapterId;
  icon: string;
};

export type WalletDescriptor = WalletMeta & { detected: boolean };

const KNOWN_WALLETS: Array<{
  match: RegExp;
  id: string;
  label: string;
  icon: string;
  installUrl: string;
}> = [
  {
    match: /suiet/i,
    id: "suiet",
    label: "Suiet",
    icon: "/wallets/suiet.png",
    installUrl: "https://suiet.app",
  },
  {
    match: /slush|sui wallet/i,
    id: "slush",
    label: "Slush",
    icon: "/wallets/slush.png",
    installUrl: "https://sui.io",
  },
  {
    match: /nightly/i,
    id: "nightly",
    label: "Nightly",
    icon: "/wallets/nightly.png",
    installUrl: "https://nightly.app/download",
  },
  {
    match: /martian/i,
    id: "martian",
    label: "Martian",
    icon: "/wallets/martian.png",
    installUrl: "https://martianwallet.xyz",
  },
  {
    match: /surf/i,
    id: "surf",
    label: "Surf",
    icon: "/wallets/surf.png",
    installUrl: "https://surfwallet.io",
  },
];

function mapInstalledWallet(w: any): WalletDescriptor | null {
  const meta = KNOWN_WALLETS.find((k) => k.match.test(w.name));
  if (!meta) return null;
  return {
    id: meta.id,
    label: meta.label,
    icon: meta.icon,
    installUrl: meta.installUrl,
    detected: true,
    adapter: w.name,
  };
}

export class WalletService {
  getAvailableWallets(): WalletDescriptor[] {
    const installed = getWallets()
      .get()
      .map(mapInstalledWallet)
      .filter(Boolean) as WalletDescriptor[];
    const installedIds = new Set(installed.map((w) => w.id));
    const suggested: WalletDescriptor[] = KNOWN_WALLETS.filter(
      (k) => !installedIds.has(k.id),
    ).map((k) => ({
      id: k.id,
      label: k.label,
      icon: k.icon,
      installUrl: k.installUrl,
      detected: false,
    }));
    return [...installed, ...suggested];
  }

  async connectWallet(adapter: WalletAdapterId): Promise<string> {
    const wallet = getWallets()
      .get()
      .find((w) => w.name === adapter || new RegExp(adapter, "i").test(w.name));
    if (!wallet) throw new Error("Wallet is not installed");
    const connect = (wallet.features["standard:connect"] as any)?.connect;
    if (connect) await connect();
    const account = wallet.accounts[0];
    if (!account) throw new Error("No account found");
    return account.address;
  }

  async signMessage(
    adapter: WalletAdapterId,
    message: string,
  ): Promise<string> {
    const wallet = getWallets()
      .get()
      .find((w) => w.name === adapter || new RegExp(adapter, "i").test(w.name));
    if (!wallet) throw new Error("Wallet is not installed");
    const feature = wallet.features["sui:signPersonalMessage"] as any;
    if (!feature?.signPersonalMessage)
      throw new Error("Wallet does not support personal message signing");
    const res = await feature.signPersonalMessage({
      message: new TextEncoder().encode(message),
    });
    return res.signature as string;
  }

  getConnectedAddress(adapter: WalletAdapterId): string | null {
    const wallet = getWallets()
      .get()
      .find((w) => w.name === adapter || new RegExp(adapter, "i").test(w.name));
    const account = wallet?.accounts?.[0];
    return account?.address || null;
  }
}

export const walletService = new WalletService();
