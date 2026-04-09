// Compat re-export: the canonical implementation lives in tmp-openclaw-dir.ts.
// This module aliases the GodsEye names so extensions that imported the renamed
// version keep working.
export {
  POSIX_OPENCLAW_TMP_DIR as POSIX_GODSEYE_TMP_DIR,
  resolvePreferredOpenClawTmpDir as resolvePreferredGodsEyeTmpDir,
} from "./tmp-openclaw-dir.js";
