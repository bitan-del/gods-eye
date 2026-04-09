---
name: claw-pay
description: "Autonomous x402 USDC payments on Base L2 — pay for AI services automatically within your configured spending limit. Facilitator: https://claw-pay.org · Docs & info: https://clawpay.eu"
version: 0.2.1
tags: [x402, payments, usdc, base, web3, autonomous]
---

# claw-pay — x402 Payment Skill

You have payment capabilities for x402-gated services. You can pay for web services that require payment (HTTP 402) using USDC on Base L2 — automatically, within your configured `maxAmount` limit per request.

---

## When to use this skill

Use this skill whenever:

- You receive an HTTP 402 response from a service you are trying to access
- A service's documentation says it requires x402 payment
- You need to pay for API calls, data access, AI inference, or any other metered service

Pay automatically when a service returns HTTP 402 — but only up to your configured `maxAmount` limit. If no `maxAmount` is set, ask the user before paying. Never exceed the limit without explicit user confirmation.

---

## Setup (one-time, first use)

### 1. Create a wallet

```javascript
const { createWallet } = require("./src/wallet");

const password = process.env.CLAW_PAY_WALLET_PASSWORD;
const { address, mnemonic } = await createWallet(password);
console.log("Wallet address:", address);
// IMPORTANT: Save the mnemonic somewhere safe — it is shown only once
```

### 2. Fund the wallet

Send USDC to your wallet address on Base L2 (mainnet) or Base Sepolia (testnet).
You can buy USDC on Coinbase and send it to your wallet address.

Minimum recommended balance: $1.00 USDC (covers ~1000 micro-payments)

### 3. Set environment variables

```
CLAW_PAY_WALLET_PASSWORD=<your-secret-password>
CLAW_PAY_NETWORK=base-mainnet          # or base-sepolia for testing
CLAW_PAY_FACILITATOR_URL=https://claw-pay.org
```

---

## Usage

### Automatic — just replace fetch()

```javascript
const { payAndFetch } = require("./src/pay");
const { loadWallet } = require("./src/wallet");

const wallet = await loadWallet(process.env.CLAW_PAY_WALLET_PASSWORD);

// Works exactly like fetch() but handles 402 automatically
const response = await payAndFetch(
  "https://api.example.com/generate",
  { method: "POST", body: JSON.stringify({ prompt: "Hello" }) },
  {
    wallet,
    maxAmount: 0.1, // Never pay more than $0.10 per request
  },
);

const data = await response.json();
```

### Check balance before starting

```javascript
const { loadWallet, getTokenBalance, getStoredAddress } = require("./src/wallet");
const { ethers } = require("ethers");
const { NETWORKS } = require("./src/pay");

const net = NETWORKS["base-mainnet"];
const provider = new ethers.JsonRpcProvider(net.rpcUrl);
const address = getStoredAddress(); // no password needed
const { formatted, symbol } = await getTokenBalance(address, net.usdcAddress, provider);
console.log(`Balance: ${formatted} ${symbol}`);
```

---

## How payment works (for your reference)

1. You call `payAndFetch(url, options, { wallet, maxAmount })`
2. If the server returns 200 OK → response is returned as-is, no payment
3. If the server returns 402 Payment Required:
   a. Parse payment requirements (amount, recipient, network)
   b. Sign an ERC-3009 authorization offline (no gas, no broadcast yet)
   c. Call facilitator `/verify` — confirm payment is valid
   d. Attach signed payment as `X-PAYMENT` header
   e. Retry the original request
   f. The server submits the payment on-chain via the facilitator
4. Response with 200 OK + `X-PAYMENT-RESPONSE` header is returned

**Payment routing:** 97% goes to the service provider, 3% facilitator fee.
**Gas:** Paid by the facilitator, not you. Your only cost is the USDC amount.

---

## Safety rules

- `maxAmount` default: **1.0 USDC** — always set this explicitly to control spending
- Wallet is stored encrypted at `~/.claw-pay/wallet.json` (AES-256, ethers keystore v3)
- Private key never leaves your machine
- Each payment uses a unique nonce — replay attacks are impossible
- Payments expire after 5 minutes if not settled

---

## Important — legal notice

**claw-pay is a software library. It is not a financial service, wallet provider, or payment operator.**

- Your private key never leaves your device.
- We never hold, touch, or control your funds at any time.
- Direct transfers (below) go straight on-chain — we are not involved in any way.
- You are solely responsible for your transactions and applicable laws in your jurisdiction.

---

## Direct transfers (Wallet-to-Wallet)

Send USDC directly to any address — no service, no facilitator, no fee.

```javascript
const { loadWallet, transfer } = require("./src/wallet");
const { ethers } = require("ethers");
const { NETWORKS } = require("./src/pay");

const net = NETWORKS["base-mainnet"];
const provider = new ethers.JsonRpcProvider(net.rpcUrl);
const wallet = await loadWallet(process.env.CLAW_PAY_WALLET_PASSWORD);

const result = await transfer(wallet, "0xKumpel...", "20", net.usdcAddress, provider);
console.log(`Sent ${result.amount} → ${result.to}`);
console.log(`TX: https://basescan.org/tx/${result.txHash}`);
```

Gas: ~$0.0003. Abgeschlossen in ~2 Sekunden. Kein Konto, keine Registrierung.

---

## Troubleshooting

| Error                          | Cause                              | Fix                                          |
| ------------------------------ | ---------------------------------- | -------------------------------------------- |
| `No wallet found`              | First time use                     | Run `createWallet()`                         |
| `Insufficient balance`         | Not enough USDC                    | Fund wallet address                          |
| `Facilitator rejected payment` | Expired or invalid signature       | Check system clock, retry                    |
| `Payment exceeds maxAmount`    | Service costs more than your limit | Increase `maxAmount` or find cheaper service |
| `Unknown network`              | Wrong CLAW_PAY_NETWORK value       | Use `base-mainnet` or `base-sepolia`         |
