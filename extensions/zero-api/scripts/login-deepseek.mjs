#!/usr/bin/env node
/**
 * Deprecated: manual DeepSeek Web credential provisioning helper.
 *
 * Auto-login now runs on first use. Just pick DeepSeek Web from the models
 * dropdown and send a message - the plugin will launch a Chrome window,
 * wait for you to log in to chat.deepseek.com, capture the cookies
 * automatically, and retry the request.
 */

console.log(
  "[zero-api] Auto-login now runs on first use. Just pick DeepSeek Web from the models dropdown and send a message.",
);
process.exit(0);
