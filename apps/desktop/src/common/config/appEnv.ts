/**
 * @license
 * Copyright 2025 Gods Eye (gods-eye.org)
 * SPDX-License-Identifier: Apache-2.0
 */

import { getPlatformServices } from '@/common/platform';

/**
 * Returns baseName unchanged in release builds, or baseName + '-dev' in dev builds.
 * When GODSEYE_MULTI_INSTANCE=1, appends '-2' to isolate the second dev instance.
 * Used to isolate symlink and directory names between environments.
 *
 * @example
 * getEnvAwareName('.godseye')        // release → '.godseye',        dev → '.godseye-dev'
 * getEnvAwareName('.godseye-config') // release → '.godseye-config', dev → '.godseye-config-dev'
 * // with GODSEYE_MULTI_INSTANCE=1:  dev → '.godseye-dev-2'
 */
export function getEnvAwareName(baseName: string): string {
  if (getPlatformServices().paths.isPackaged() === true) return baseName;
  const suffix = process.env.GODSEYE_MULTI_INSTANCE === '1' ? '-dev-2' : '-dev';
  return `${baseName}${suffix}`;
}
