"use strict";

/**
 * claw-pay pay.js
 * x402 Payment Flow — detects HTTP 402, builds payload, pays via facilitator.
 */

const { ethers } = require("ethers");
const { signTransferWithAuthorization, randomNonce, expiryTimestamp } = require("./wallet");

// ── Configuration ─────────────────────────────────────────────────────────────

const NETWORKS = {
  "base-mainnet": {
    chainId: 8453,
    rpcUrl: "https://mainnet.base.org",
    usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    usdcName: "USD Coin",
    usdcVersion: "2",
  },
  "base-sepolia": {
    chainId: 84532,
    rpcUrl: "https://sepolia.base.org",
    // TestUSDC on Base Sepolia (ERC-3009 compatible)
    usdcAddress: "0x83d67b7417b63d2F868E1d34dCFc8F99b095B294",
    usdcName: "Test USD Coin",
    usdcVersion: "1",
  },
};

const FACILITATOR_URL = process.env.CLAW_PAY_FACILITATOR_URL ?? "https://claw-pay.org";
const DEFAULT_NETWORK = process.env.CLAW_PAY_NETWORK ?? "base-mainnet";
const PAYMENT_EXPIRY_SECONDS = 300; // 5 minutes

// ── Core payment flow ─────────────────────────────────────────────────────────

/**
 * Make an HTTP request, automatically handle x402 payment if required.
 *
 * Drop-in replacement for fetch() — the agent just calls payAndFetch() instead
 * of fetch() and everything happens automatically.
 *
 * @param {string}       url
 * @param {RequestInit}  [options]   Standard fetch options
 * @param {object}       payOptions
 * @param {ethers.Wallet} payOptions.wallet     Loaded wallet for signing
 * @param {string}       [payOptions.network]   Override network
 * @param {number}       [payOptions.maxAmount] Max payment in USD (safety limit)
 * @returns {Promise<Response>}
 */
async function payAndFetch(url, options = {}, payOptions = {}) {
  const response = await fetch(url, options);

  if (response.status !== 402) {
    return response;
  }

  const paymentRequired = await parsePaymentRequired(response);
  if (!paymentRequired) {
    throw new Error("Server returned 402 but no valid x402 payment requirements found");
  }

  // Safety check: refuse to pay more than maxAmount (default: 1.0 USDC)
  const maxAmount = payOptions.maxAmount ?? 1.0;
  const requiredUsd = Number(paymentRequired.maxAmountRequired) / 1_000_000;
  if (requiredUsd > maxAmount) {
    throw new Error(`Payment required ($${requiredUsd}) exceeds maxAmount limit ($${maxAmount})`);
  }

  const paymentHeader = await createPaymentHeader(
    paymentRequired,
    payOptions.wallet,
    payOptions.network ?? DEFAULT_NETWORK,
  );

  // Retry original request with payment header
  const retryOptions = {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      "X-PAYMENT": paymentHeader,
      "Access-Control-Expose-Headers": "X-PAYMENT-RESPONSE",
    },
  };

  return fetch(url, retryOptions);
}

/**
 * Parse x402 payment requirements from a 402 response.
 * @param {Response} response
 * @returns {Promise<object|null>}  PaymentRequirements or null if not x402
 */
async function parsePaymentRequired(response) {
  try {
    const body = await response.json();
    // x402 spec: response body contains array of payment options
    const requirements = Array.isArray(body) ? body : [body];

    // Find first option we support (exact + eip3009 + base network)
    return (
      requirements.find(
        (r) => r.scheme === "exact" && r.network?.startsWith("base") && r.asset, // has token address
      ) ?? null
    );
  } catch {
    return null;
  }
}

/**
 * Build and return a Base64-encoded X-PAYMENT header value.
 * Calls facilitator /verify to confirm before returning.
 *
 * @param {object}        requirements  PaymentRequirements from server
 * @param {ethers.Wallet} wallet
 * @param {string}        network
 * @returns {Promise<string>}  Base64 encoded payment payload
 */
async function createPaymentHeader(requirements, wallet, network = DEFAULT_NETWORK) {
  const net = NETWORKS[network];
  if (!net) throw new Error(`Unknown network: ${network}`);

  const nonce = randomNonce();
  const validBefore = expiryTimestamp(PAYMENT_EXPIRY_SECONDS);
  const value = BigInt(requirements.maxAmountRequired);

  const signature = await signTransferWithAuthorization(
    wallet,
    {
      to: requirements.payTo, // facilitator address (pays seller after split)
      value,
      validAfter: 0n,
      validBefore,
      nonce,
    },
    {
      name: net.usdcName,
      version: net.usdcVersion,
      chainId: net.chainId,
      verifyingContract: net.usdcAddress,
    },
  );

  const payload = {
    x402Version: 1,
    scheme: "exact",
    network,
    payload: {
      signature,
      authorization: {
        from: wallet.address,
        to: requirements.payTo,
        value: toHex(value),
        validAfter: toHex(0n),
        validBefore: toHex(validBefore),
        nonce,
      },
    },
  };

  // Optional: verify with facilitator before sending (catches issues early)
  await verifyWithFacilitator(payload, requirements);

  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

// ── Facilitator communication ─────────────────────────────────────────────────

/**
 * Call facilitator /verify — throws if payment is invalid.
 * @param {object} paymentPayload
 * @param {object} paymentRequirements
 */
async function verifyWithFacilitator(paymentPayload, paymentRequirements) {
  const res = await fetch(`${FACILITATOR_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      payment_payload: paymentPayload,
      payment_requirements: paymentRequirements,
    }),
  });

  const data = await res.json();
  if (!data.is_valid) {
    throw new Error(`Facilitator rejected payment: ${data.invalid_reason ?? "unknown reason"}`);
  }
}

/**
 * Manually settle a payment (for direct use without payAndFetch).
 * @param {object} paymentPayload
 * @param {object} paymentRequirements
 * @returns {Promise<{success: boolean, txHash: string, fee: string}>}
 */
async function settleWithFacilitator(paymentPayload, paymentRequirements) {
  const res = await fetch(`${FACILITATOR_URL}/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      payment_payload: paymentPayload,
      payment_requirements: paymentRequirements,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Settlement failed: ${err.detail ?? res.statusText}`);
  }

  return res.json();
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Convert BigInt to 0x-prefixed hex string.
 * @param {bigint} value
 * @returns {string}
 */
function toHex(value) {
  return "0x" + value.toString(16);
}

/**
 * Parse USDC amount from human-readable string to base units (6 decimals).
 * e.g. "0.01" → 10000n
 * @param {string|number} amount
 * @returns {bigint}
 */
function usdcUnits(amount) {
  return BigInt(Math.round(Number(amount) * 1_000_000));
}

module.exports = {
  payAndFetch,
  parsePaymentRequired,
  createPaymentHeader,
  verifyWithFacilitator,
  settleWithFacilitator,
  usdcUnits,
  NETWORKS,
  FACILITATOR_URL,
};
