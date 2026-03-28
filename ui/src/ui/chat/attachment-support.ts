export const CHAT_ATTACHMENT_ACCEPT =
  "image/*,.pdf,.txt,.md,.json,.csv,.xml,.html,.js,.ts,.py,.yaml,.yml,.toml,.log";

/** Maximum attachment file size in bytes (10 MB). */
export const CHAT_ATTACHMENT_MAX_BYTES = 10_000_000;

const SUPPORTED_TEXT_EXTENSIONS = new Set([
  ".pdf",
  ".txt",
  ".md",
  ".json",
  ".csv",
  ".xml",
  ".html",
  ".js",
  ".ts",
  ".py",
  ".yaml",
  ".yml",
  ".toml",
  ".log",
]);

export function isSupportedChatAttachmentMimeType(mimeType: string | null | undefined): boolean {
  if (typeof mimeType !== "string") {
    return false;
  }
  if (mimeType.startsWith("image/")) {
    return true;
  }
  if (mimeType === "application/pdf") {
    return true;
  }
  if (mimeType.startsWith("text/")) {
    return true;
  }
  if (mimeType === "application/json") {
    return true;
  }
  if (mimeType === "application/xml") {
    return true;
  }
  return false;
}

/** Check whether a file name has a supported extension for chat attachments. */
export function isSupportedChatAttachmentExtension(fileName: string | null | undefined): boolean {
  if (typeof fileName !== "string") {
    return false;
  }
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) {
    return false;
  }
  return SUPPORTED_TEXT_EXTENSIONS.has(fileName.slice(dot).toLowerCase());
}
