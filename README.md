# Suimo — Authorized data for AI agents (powered by Walrus and Sui)

Suimo lets AI agents fetch authorized content with consent, metering, and instant settlement in WAL tokens on Sui. Content blobs are stored publicly on Walrus, encrypted with Seal and unlocked on-chain via policy-gated decryption.

## Powered by Walrus & Sui

- **Walrus Storage**: All data resources (files, datasets) are stored as blobs on Walrus.
- **Seal Encryption**: Data is encrypted client-side using Mysten's Seal before upload.
- **Policy-Gated Access**: Decryption keys are only released to authorized parties (the platform) after on-chain payment verification.
- **Sui Payments**: Real-time settlement using WAL tokens on the Sui testnet.
- **MCP Gateway**: A standard interface for AI agents to discover, purchase, and use these decentralized resources.

## Table of contents

- [1) What Suimo does](#1-what-suimo-does)
- [2) How it works](#2-how-it-works)
- [3) Architecture](#3-architecture)
- [4) Protocols and standards](#4-protocols-and-standards)
- [5) Core data model](#5-core-data-model)
- [6) Setup](#6-setup)
  - [Prerequisites](#prerequisites)
  - [Server environment (server/.env)](#server-environment-serverenv)
  - [Client environment (client/.env)](#client-environment-clientenv)
  - [Run locally](#run-locally)
- [7) MCP tools](#7-mcp-tools)
- [8) Receipts and verification](#8-receipts-and-verification)
- [9) Domain verification](#9-domain-verification)
- [10) Troubleshooting](#10-troubleshooting)

---

## 1) What Suimo does

- Consent-first access for agents to provider resources (sites, datasets, files)
- Usage-based pricing (flat or per-KB) in WAL tokens
- Settlement: Instant WAL transfer from consumer to platform, then platform to provider
- Privacy: client-side encryption (Seal) → public blob storage (Walrus) → policy-gated decryption

## 2) How it works

1. Agents authenticate and discover resources via MCP (OAuth 2.1 + PKCE).
2. For file/dataset uploads, the client encrypts locally with Seal and uploads the encrypted envelope; the server stores it on Walrus.
3. For fetches, Suimo calculates the WAL cost, executes a transfer from the consumer's custodial wallet, pays the provider, fetches the ciphertext from Walrus, authorizes decryption via Seal (policy session), and returns plaintext chunks.
4. Every access yields an Ed25519-signed receipt, with links to Sui Explorer for payouts.

## 3) Architecture

- Client (React + Vite)
  - Consumer and Provider dashboards, wallet linking (Sui Wallet Standard), resource management
- Server (Fastify + TypeScript + MongoDB)
  - Auth: email/password and Sui wallet login; OAuth 2.1 for MCP
  - MCP runtime: `suimo-mcp` tools for discovery and fetch
  - Settlement: Custodial WAL wallet management + on-chain payouts
  - Storage: Walrus blob write/read/delete; Seal decryption flow for policy-gated access
  - Receipts: Ed25519 JWT signatures, Sui explorer links

## 4) Protocols and standards

- MCP (Model Context Protocol): standardized tools for agent integrations
- OAuth 2.1 + PKCE: authorize agents to use MCP tools against Suimo’s protected resource
- Sui + WAL: provider payouts in WAL tokens; receipts link to Sui Explorer
- Walrus: public, content-addressed blob storage for encrypted payloads
- Seal (Mysten): client-side encryption and on-chain policy-gated decryption

## 5) Core data model

Resource fields include:

- Identity and pricing: `title`, `type` (`site|dataset|file`), `format`, `visibility`, `price_flat`, `price_per_kb`, `modes` (`raw|summary`)
- Storage and crypto: `walrus_blob_id`, `walrus_blob_object_id`, `walrus_quilt_id?`, `cipher_meta` (algo, size), `size_bytes`, `seal_policy_id`
- Provenance: `domain` (for sites), `verified`, `tags`, `sample_preview|summary`

## 6) Setup

### Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)

### Server environment (server/.env)

Minimum:

- `PORT=3000`
- `MONGODB_URI=mongodb://localhost:27017/suimo`
- `KEY_ENCRYPTION_KEY=<long-random-secret>` (encrypts internal secrets)
- `CLIENT_APP_URL=http://localhost:5173`

OAuth / receipts (Ed25519 JWT):

- `ED25519_PRIVATE_KEY_PATH=/path/to/private-key.pem` (PKCS#8 seed for signing)
- Optional: `OAUTH_ISSUER` (default `https://suimo.local`), `OAUTH_RESOURCE` (defaults to `<base>/mcp`)

Sui + payout:

- `SUI_RPC_URL=https://fullnode.testnet.sui.io`
- `SUI_PLATFORM_PRIVATE_KEY=<base64-ed25519-secret>` (platform signer)
- `SUI_PAYTO=<platform Sui address>` (custodial recipient / payout source)
- `WAL_COIN_TYPE=0x8270feb7375eee355e64fdb69c50abb6b5f9393a722883c1cf45f8e26048810a::wal::WAL`
- `WAL_DECIMALS=9`

Walrus + Seal:

- `WALRUS_NETWORK=testnet|mainnet`
- `SEAL_POLICY_PACKAGE=0x<policy_package_id>`

Session cookies (optional):

- `SESSION_COOKIE_NAME=suimo_session`, `SESSION_COOKIE_DOMAIN=`, `SESSION_COOKIE_SECURE=false`, `SESSION_COOKIE_MAX_AGE=604800`

### Client environment (client/.env)

- `VITE_API_BASE_URL=http://localhost:3000`
- `VITE_SUI_RPC_URL=https://fullnode.testnet.sui.io`
- `VITE_WALRUS_NETWORK=testnet|mainnet`
- `VITE_SEAL_POLICY_PACKAGE=0x<policy_package_id>`
- `VITE_SEAL_KEY_SERVERS=<csv of Seal key server object IDs>`

### Run locally

Server:

```bash
cd server
npm install
cp .env.example .env
npm run dev # http://localhost:3000
```

Client:

```bash
cd client
npm install
cp .env.example .env
npm run dev # http://localhost:5173
```

Production:

```bash
cd server && npm run build && npm start
```

## 7) MCP tools

Base: `https://api.suimo.com/mcp` (or your local base)

### discover_resources

- Input: `{ query: string, mode?: 'raw'|'summary', filters?: { format?: string[], maxCost?: number } }`
- Output: `{ results: Array<{ resourceId, title, type, format, priceEstimate, ... }>, recommended?: string }`

### fetch_content

- Input: `{ resourceId: string, mode: 'raw'|'summary', constraints?: { maxCost?: number, maxBytes?: number } }`
- Behavior: returns `{ content, receipt }` where `content` is `{ chunks: string[] }` and `receipt` links to Sui Explorer

## 8) Receipts and verification

- Ed25519 JWT receipts signed server-side (verify with the public key)
- Fields include bytes billed, price, totals, payout tx digest, and signature
- UI links to Sui Explorer for payout transactions

## 9) Domain verification

- DNS TXT: add `suimo-verify=<token>`
- File: host `/.well-known/suimo.txt` with the token as the file content

## 10) Troubleshooting

- Decryption blocked: confirm `VITE_SEAL_KEY_SERVERS`, `VITE_SEAL_POLICY_PACKAGE`, and Sui RPC
- Uploads fail: verify Walrus network and platform signer on the server
- Payouts fail: ensure `SUI_PLATFORM_PRIVATE_KEY` is valid and funded; `WAL_COIN_TYPE` correct for your network
