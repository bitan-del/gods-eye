import type { GodsEyeConfig } from "../../config/types.js";

export type DirectoryConfigParams = {
  cfg: GodsEyeConfig;
  accountId?: string | null;
  query?: string | null;
  limit?: number | null;
};
