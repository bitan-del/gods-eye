/**
 * @license
 * Copyright 2025 Gods Eye (gods-eye.org)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Device Auth Store for OpenClaw Gateway Authentication
 *
 * Based on OpenClaw's device-auth-store implementation.
 * Stores device tokens for role-based authentication.
 *
 * Storage location: ~/.openclaw/identity/device-auth.json
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface DeviceAuthEntry {
  token: string;
  role: string;
  scopes: string[];
  updatedAtMs: number;
}

interface DeviceAuthStore {
  version: 1;
  deviceId: string;
  tokens: Record<string, DeviceAuthEntry>;
}

// Gods Eye uses ~/.godseye/identity/device-auth.json; fall back to ~/.openclaw for migrated installs
const GODSEYE_STATE_DIR = path.join(os.homedir(), '.godseye');
const LEGACY_STATE_DIR = path.join(os.homedir(), '.openclaw');
const DEVICE_AUTH_FILE = 'device-auth.json';

function resolveDeviceAuthPath(): string {
  const override = process.env.GODSEYE_STATE_DIR?.trim() || process.env.OPENCLAW_STATE_DIR?.trim();
  if (override) {
    return path.join(override, 'identity', DEVICE_AUTH_FILE);
  }
  // Check .godseye first, then .openclaw
  const godseyePath = path.join(GODSEYE_STATE_DIR, 'identity', DEVICE_AUTH_FILE);
  if (fs.existsSync(godseyePath)) {
    return godseyePath;
  }
  const legacyPath = path.join(LEGACY_STATE_DIR, 'identity', DEVICE_AUTH_FILE);
  if (fs.existsSync(legacyPath)) {
    return legacyPath;
  }
  // Default to .godseye for new entries
  return godseyePath;
}

function normalizeRole(role: string): string {
  return role.trim();
}

function normalizeScopes(scopes: string[] | undefined): string[] {
  if (!Array.isArray(scopes)) {
    return [];
  }
  const out = new Set<string>();
  for (const scope of scopes) {
    const trimmed = scope.trim();
    if (trimmed) {
      out.add(trimmed);
    }
  }
  return [...out].toSorted();
}

function readStore(filePath: string): DeviceAuthStore | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as DeviceAuthStore;
    if (parsed?.version !== 1 || typeof parsed.deviceId !== 'string') {
      return null;
    }
    if (!parsed.tokens || typeof parsed.tokens !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStore(filePath: string, store: DeviceAuthStore): void {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
    try {
      fs.chmodSync(filePath, 0o600);
    } catch {
      // best-effort
    }
  } catch {
    // Silently ignore write failures (EROFS, EACCES, ENOSPC, etc.)
    // The user will simply need to re-authenticate next session.
  }
}

/**
 * Load device auth token for a specific device and role
 */
export function loadDeviceAuthToken(params: { deviceId: string; role: string }): DeviceAuthEntry | null {
  const filePath = resolveDeviceAuthPath();
  const store = readStore(filePath);
  if (!store) {
    return null;
  }
  if (store.deviceId !== params.deviceId) {
    return null;
  }
  const role = normalizeRole(params.role);
  const entry = store.tokens[role];
  if (!entry || typeof entry.token !== 'string') {
    return null;
  }
  return entry;
}

/**
 * Store device auth token for a specific device and role
 */
export function storeDeviceAuthToken(params: {
  deviceId: string;
  role: string;
  token: string;
  scopes?: string[];
}): DeviceAuthEntry {
  const filePath = resolveDeviceAuthPath();
  const existing = readStore(filePath);
  const role = normalizeRole(params.role);
  const next: DeviceAuthStore = {
    version: 1,
    deviceId: params.deviceId,
    tokens: existing && existing.deviceId === params.deviceId && existing.tokens ? { ...existing.tokens } : {},
  };
  const entry: DeviceAuthEntry = {
    token: params.token,
    role,
    scopes: normalizeScopes(params.scopes),
    updatedAtMs: Date.now(),
  };
  next.tokens[role] = entry;
  writeStore(filePath, next);
  return entry;
}

/**
 * Clear device auth token for a specific device and role
 */
export function clearDeviceAuthToken(params: { deviceId: string; role: string }): void {
  const filePath = resolveDeviceAuthPath();
  const store = readStore(filePath);
  if (!store || store.deviceId !== params.deviceId) {
    return;
  }
  const role = normalizeRole(params.role);
  if (!store.tokens[role]) {
    return;
  }
  const next: DeviceAuthStore = {
    version: 1,
    deviceId: store.deviceId,
    tokens: { ...store.tokens },
  };
  delete next.tokens[role];
  writeStore(filePath, next);
}
