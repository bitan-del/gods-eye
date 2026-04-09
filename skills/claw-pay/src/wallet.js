"use strict";

/**
 * claw-pay wallet.js
 * Key management and EIP-712 signing for x402 / ERC-3009 payments.
 * Uses ethers v6 — no native modules, runs anywhere Node ≥ 18 runs.
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const DEFAULT_WALLET_PATH = path.join(os.homedir(), ".claw-pay", "wallet.json");

// ── Key management ────────────────────────────────────────────────────────────

/**
 * Create a new random wallet and save it encrypted to disk.
 * @param {string} password  Passphrase for AES encryption (ethers keystore v3)
 * @param {string} [filePath]  Override default storage path
 * @returns {Promise<{address: string, mnemonic: string}>}
 */
async function createWallet(password, filePath = DEFAULT_WALLET_PATH) {
  if (!password) throw new Error("Password required to create wallet");

  const wallet = ethers.Wallet.createRandom();
  const encrypted = await wallet.encrypt(password);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, encrypted, { mode: 0o600 });

  return {
    address: wallet.address,
    mnemonic: wallet.mnemonic?.phrase ?? null,
  };
}

/**
 * Load an existing wallet from disk.
 * @param {string} password
 * @param {string} [filePath]
 * @returns {Promise<ethers.Wallet>}
 */
async function loadWallet(password, filePath = DEFAULT_WALLET_PATH) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`No wallet found at ${filePath}. Run createWallet() first.`);
  }
  const encrypted = fs.readFileSync(filePath, "utf8");
  return ethers.Wallet.fromEncryptedJson(encrypted, password);
}

/**
 * Return wallet address without decrypting (reads keystore JSON directly).
 * @param {string} [filePath]
 * @returns {string|null}
 */
function getStoredAddress(filePath = DEFAULT_WALLET_PATH) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const keystore = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return ethers.getAddress("0x" + keystore.address);
  } catch {
    return null;
  }
}

// ── ERC-3009 / EIP-712 signing ────────────────────────────────────────────────

/**
 * Sign an ERC-3009 TransferWithAuthorization message.
 *
 * @param {ethers.Wallet} wallet       Loaded (decrypted) wallet
 * @param {object}        auth         Authorization fields
 * @param {string}        auth.to      Recipient address (facilitator)
 * @param {bigint}        auth.value   Amount in token base units (e.g. 6 decimals for USDC)
 * @param {bigint}        auth.validAfter   Unix timestamp (0 = any time)
 * @param {bigint}        auth.validBefore  Unix timestamp (expiry)
 * @param {string}        auth.nonce   32-byte hex nonce (0x-prefixed)
 * @param {object}        domainParams
 * @param {string}        domainParams.name            Token contract name (e.g. "USD Coin")
 * @param {string}        domainParams.version         Token contract version (e.g. "2")
 * @param {number}        domainParams.chainId
 * @param {string}        domainParams.verifyingContract  Token contract address
 * @returns {Promise<string>}  65-byte hex signature (0x-prefixed)
 */
async function signTransferWithAuthorization(wallet, auth, domainParams) {
  const domain = {
    name: domainParams.name,
    version: domainParams.version,
    chainId: domainParams.chainId,
    verifyingContract: domainParams.verifyingContract,
  };

  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  };

  const message = {
    from: wallet.address,
    to: auth.to,
    value: auth.value,
    validAfter: auth.validAfter,
    validBefore: auth.validBefore,
    nonce: auth.nonce,
  };

  const signature = await wallet.signTypedData(domain, types, message);
  return signature; // 0x + 130 hex chars (65 bytes)
}

// ── Balance helper ────────────────────────────────────────────────────────────

/**
 * Read ERC-20 token balance.
 * @param {string}          address   Wallet address
 * @param {string}          tokenAddress  ERC-20 contract address
 * @param {ethers.Provider} provider
 * @returns {Promise<{raw: bigint, formatted: string}>}  formatted = human-readable (6 decimals)
 */
async function getTokenBalance(address, tokenAddress, provider) {
  const abi = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
  ];
  const token = new ethers.Contract(tokenAddress, abi, provider);
  const [raw, decimals, symbol] = await Promise.all([
    token.balanceOf(address),
    token.decimals(),
    token.symbol(),
  ]);
  return {
    raw,
    formatted: ethers.formatUnits(raw, decimals),
    symbol,
  };
}

// ── Nonce helpers ─────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random bytes32 nonce (0x-prefixed).
 * @returns {string}
 */
function randomNonce() {
  return "0x" + crypto.randomBytes(32).toString("hex");
}

/**
 * Unix timestamp N seconds from now.
 * @param {number} secondsFromNow
 * @returns {bigint}
 */
function expiryTimestamp(secondsFromNow = 300) {
  return BigInt(Math.floor(Date.now() / 1000) + secondsFromNow);
}

// ── Direct transfer ───────────────────────────────────────────────────────────

/**
 * Send ERC-20 tokens directly to any address.
 * No facilitator, no x402 — plain on-chain transfer.
 *
 * @param {ethers.Wallet}   wallet        Loaded (decrypted) wallet
 * @param {string}          to            Recipient address or ENS name
 * @param {string|number}   amount        Human-readable amount (e.g. "20" for 20 USDC)
 * @param {string}          tokenAddress  ERC-20 contract address
 * @param {ethers.Provider} provider
 * @returns {Promise<{txHash: string, amount: string, to: string}>}
 */
async function transfer(wallet, to, amount, tokenAddress, provider) {
  const abi = [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
  ];

  const connectedWallet = wallet.connect(provider);
  const token = new ethers.Contract(tokenAddress, abi, connectedWallet);

  const decimals = await token.decimals();
  const symbol = await token.symbol();
  const units = ethers.parseUnits(String(amount), decimals);

  const tx = await token.transfer(to, units);
  await tx.wait();

  return {
    txHash: tx.hash,
    amount: `${amount} ${symbol}`,
    to,
  };
}

module.exports = {
  createWallet,
  loadWallet,
  getStoredAddress,
  signTransferWithAuthorization,
  getTokenBalance,
  transfer,
  randomNonce,
  expiryTimestamp,
};
