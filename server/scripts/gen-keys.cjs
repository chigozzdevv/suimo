const fs = require("fs");
const path = require("path");
const { randomBytes, generateKeyPairSync } = require("crypto");
const { Ed25519Keypair } = require("@mysten/sui/keypairs/ed25519");

function genEncKeyB64() {
  return randomBytes(32).toString("base64");
}

function genSuiKeypair() {
  const seed = randomBytes(32);
  const kp = Ed25519Keypair.fromSecretKey(seed);
  const address = kp.getPublicKey().toSuiAddress();
  const bech32 = kp.getSecretKey();
  const seedB64 = Buffer.from(seed).toString("base64");
  return { seedB64, bech32, address };
}

function genEd25519Pem() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const pem = privateKey.export({ type: "pkcs8", format: "pem" });
  const pub = publicKey.export({ type: "spki", format: "pem" });
  return { pem, pub };
}

function setEnvKV(envText, key, val) {
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(envText)) return envText.replace(re, `${key}=${val}`);
  const nl = envText.endsWith("\n") ? "" : "\n";
  return envText + `${nl}${key}=${val}\n`;
}

(function main() {
  const out = {};
  out.encKey = genEncKeyB64();
  out.sui = genSuiKeypair();
  out.oauth = genEd25519Pem();

  const keysDir = path.resolve(__dirname, "../keys");
  fs.mkdirSync(keysDir, { recursive: true });
  const oauthPemPath = path.join(keysDir, "oauth_private_key.pem");
  fs.writeFileSync(oauthPemPath, out.oauth.pem, { mode: 0o600 });

  const envPath = path.resolve(__dirname, "../.env");
  let envText = "";
  try {
    envText = fs.readFileSync(envPath, "utf8");
  } catch {
    envText = "";
  }

  envText = setEnvKV(envText, "KEY_ENCRYPTION_KEY", out.encKey);
  envText = setEnvKV(
    envText,
    "ED25519_PRIVATE_KEY_PATH",
    "./keys/oauth_private_key.pem",
  );
  envText = setEnvKV(envText, "SUI_PLATFORM_PRIVATE_KEY", out.sui.seedB64);
  envText = setEnvKV(envText, "SUI_PAYTO", out.sui.address);
  // Circle USDC (Sui Testnet)
  envText = setEnvKV(
    envText,
    "SUI_USDC_TYPE",
    "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC",
  );

  fs.writeFileSync(envPath, envText);

  console.log(
    JSON.stringify(
      {
        encKey: out.encKey,
        sui: out.sui,
        oauth: { pemPath: oauthPemPath },
      },
      null,
      2,
    ),
  );
})();
