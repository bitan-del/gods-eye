import type { GatewayBrowserClient } from "../gateway.ts";
import type { ChannelsStatusSnapshot, ChannelAccountSnapshot } from "../types.ts";

export type ConnectorDefinition = {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  fields: ConnectorField[];
  setupSteps: string[];
  guideUrl?: string;
};

export type ConnectorField = {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
  sensitive: boolean;
  configPath: string[];
};

export type ConnectorsState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  connectorsLoading: boolean;
  connectorsSnapshot: ChannelsStatusSnapshot | null;
  connectorsError: string | null;
  connectorsConfiguring: string | null;
  connectorsFormValues: Record<string, string>;
  connectorsFormErrors: Record<string, string>;
  connectorsSaving: boolean;
  connectorsSaveError: string | null;
  connectorsSearch: string;
  connectorsValidating: boolean;
};

/**
 * Static catalog of connector definitions with their required fields
 * and setup instructions.
 */
export const CONNECTOR_CATALOG: ConnectorDefinition[] = [
  {
    id: "telegram",
    label: "Telegram",
    description: "Quickly connect to an official Telegram bot for seamless global communication.",
    icon: "telegram",
    color: "#26A5E4",
    setupSteps: [
      "Open Telegram and search for @BotFather",
      "Send /newbot and follow the instructions",
      "Copy the bot token provided",
      "Paste the token below",
    ],
    guideUrl: "https://core.telegram.org/bots#botfather",
    fields: [
      {
        key: "botToken",
        label: "Bot Token",
        placeholder: "Enter bot token from @BotFather",
        required: true,
        sensitive: true,
        configPath: ["channels", "telegram", "accounts", "default", "botToken"],
      },
    ],
  },
  {
    id: "discord",
    label: "Discord",
    description: "Create a dedicated Discord community bot to provide smart interactive services.",
    icon: "discord",
    color: "#5865F2",
    setupSteps: [
      "Go to discord.com/developers/applications",
      "Create a new application",
      "Go to Bot section and copy the token",
      "Invite bot to your server with required permissions",
    ],
    guideUrl: "https://discord.com/developers/docs/intro",
    fields: [
      {
        key: "token",
        label: "Bot Token",
        placeholder: "Enter Discord bot token",
        required: true,
        sensitive: true,
        configPath: ["channels", "discord", "accounts", "default", "token"],
      },
    ],
  },
  {
    id: "slack",
    label: "Slack",
    description: "Connect Slack using bot and app tokens for workspace integration.",
    icon: "slack",
    color: "#4A154B",
    setupSteps: [
      "Go to api.slack.com/apps",
      "Create a new app from scratch",
      "Add required OAuth scopes",
      "Install to workspace and copy tokens",
    ],
    guideUrl: "https://api.slack.com/start",
    fields: [
      {
        key: "botToken",
        label: "Bot Token",
        placeholder: "xoxb-...",
        required: true,
        sensitive: true,
        configPath: ["channels", "slack", "accounts", "default", "botToken"],
      },
      {
        key: "appToken",
        label: "App Token",
        placeholder: "xapp-...",
        required: true,
        sensitive: true,
        configPath: ["channels", "slack", "accounts", "default", "appToken"],
      },
    ],
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    description: "Connect to WhatsApp via QR scanning for quick global business communication.",
    icon: "whatsapp",
    color: "#25D366",
    setupSteps: [
      "Click Connect to generate a QR code",
      "Open WhatsApp on your phone",
      "Go to Settings > Linked Devices > Link a Device",
      "Scan the QR code displayed here",
    ],
    fields: [],
  },
  {
    id: "signal",
    label: "Signal",
    description:
      "Connect to the highly private Signal messenger using local signal-cli integration.",
    icon: "signal",
    color: "#3A76F0",
    setupSteps: [
      "Install signal-cli on your system",
      "Register or link your Signal account with signal-cli",
      "Configure the HTTP daemon URL below",
      "The gateway will auto-start signal-cli if not running",
    ],
    guideUrl: "https://github.com/AsamK/signal-cli",
    fields: [
      {
        key: "account",
        label: "Phone Number",
        placeholder: "+1234567890 (E.164 format)",
        required: false,
        sensitive: false,
        configPath: ["channels", "signal", "accounts", "default", "account"],
      },
      {
        key: "httpUrl",
        label: "HTTP Daemon URL",
        placeholder: "http://127.0.0.1:8080",
        required: false,
        sensitive: false,
        configPath: ["channels", "signal", "accounts", "default", "httpUrl"],
      },
    ],
  },
  {
    id: "msteams",
    label: "MS Teams",
    description:
      "Connect Microsoft Teams for centralized enterprise AI assistant interactions and automation.",
    icon: "msteams",
    color: "#6264A7",
    setupSteps: [
      "Create an Azure Bot resource in the Azure Portal",
      "Note down the App ID and App Password (Client Secret)",
      "Configure the messaging endpoint to point to your gateway",
      "Paste credentials below",
    ],
    guideUrl:
      "https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/create-a-bot-for-teams",
    fields: [
      {
        key: "appId",
        label: "App ID",
        placeholder: "Azure Bot App ID",
        required: true,
        sensitive: false,
        configPath: ["channels", "msteams", "appId"],
      },
      {
        key: "appPassword",
        label: "App Password",
        placeholder: "Azure Bot Client Secret",
        required: true,
        sensitive: true,
        configPath: ["channels", "msteams", "appPassword"],
      },
    ],
  },
  {
    id: "matrix",
    label: "Matrix",
    description: "Connect to the Matrix decentralized network for open, federated messaging.",
    icon: "matrix",
    color: "#0DBD8B",
    setupSteps: [
      "Create a bot account on your Matrix homeserver",
      "Get the access token for the bot account",
      "Enter the homeserver URL and access token below",
    ],
    fields: [
      {
        key: "homeserver",
        label: "Homeserver URL",
        placeholder: "https://matrix.org",
        required: true,
        sensitive: false,
        configPath: ["channels", "matrix", "accounts", "default", "homeserver"],
      },
      {
        key: "accessToken",
        label: "Access Token",
        placeholder: "Enter Matrix access token",
        required: true,
        sensitive: true,
        configPath: ["channels", "matrix", "accounts", "default", "accessToken"],
      },
      {
        key: "userId",
        label: "User ID",
        placeholder: "@bot:matrix.org",
        required: false,
        sensitive: false,
        configPath: ["channels", "matrix", "accounts", "default", "userId"],
      },
    ],
  },
  {
    id: "googlechat",
    label: "Google Chat",
    description: "Integrate with Google Chat for automated workspace messaging and interactions.",
    icon: "googlechat",
    color: "#00AC47",
    setupSteps: [
      "Create a Google Cloud project and enable the Chat API",
      "Create a service account and download the JSON key",
      "Configure the Chat app in the Google Admin console",
      "Paste the service account JSON or file path below",
    ],
    guideUrl: "https://developers.google.com/workspace/chat/overview",
    fields: [
      {
        key: "audience",
        label: "Audience",
        placeholder: "App URL or project number",
        required: true,
        sensitive: false,
        configPath: ["channels", "googlechat", "accounts", "default", "audience"],
      },
      {
        key: "serviceAccountFile",
        label: "Service Account File",
        placeholder: "Path to service-account.json",
        required: false,
        sensitive: false,
        configPath: ["channels", "googlechat", "accounts", "default", "serviceAccountFile"],
      },
    ],
  },
  {
    id: "irc",
    label: "IRC",
    description: "Connect to IRC networks for classic real-time text communication.",
    icon: "irc",
    color: "#6B7280",
    setupSteps: [
      "Choose an IRC network (e.g., irc.libera.chat)",
      "Decide on a nickname for your bot",
      "Configure TLS and port settings if needed",
      "Enter the connection details below",
    ],
    fields: [
      {
        key: "host",
        label: "Server Host",
        placeholder: "irc.libera.chat",
        required: true,
        sensitive: false,
        configPath: ["channels", "irc", "accounts", "default", "host"],
      },
      {
        key: "nick",
        label: "Nickname",
        placeholder: "godseye-bot",
        required: false,
        sensitive: false,
        configPath: ["channels", "irc", "accounts", "default", "nick"],
      },
      {
        key: "password",
        label: "Server Password",
        placeholder: "Optional server password",
        required: false,
        sensitive: true,
        configPath: ["channels", "irc", "accounts", "default", "password"],
      },
    ],
  },
  {
    id: "imessage",
    label: "iMessage",
    description: "Natively integrate into the Apple iMessage ecosystem based on macOS.",
    icon: "imessage",
    color: "#34C759",
    setupSteps: [
      "Ensure you are running on macOS with Messages.app configured",
      "Install the imsg CLI tool",
      "Grant accessibility and full disk access permissions",
      "The gateway will connect automatically",
    ],
    fields: [
      {
        key: "cliPath",
        label: "CLI Path",
        placeholder: "imsg (default)",
        required: false,
        sensitive: false,
        configPath: ["channels", "imessage", "accounts", "default", "cliPath"],
      },
    ],
  },
];

export function getConnectorStatus(
  connectorId: string,
  snapshot: ChannelsStatusSnapshot | null,
): {
  configured: boolean;
  connected: boolean;
  running: boolean;
  account: ChannelAccountSnapshot | null;
} {
  if (!snapshot) {
    return { configured: false, connected: false, running: false, account: null };
  }
  const accounts = snapshot.channelAccounts?.[connectorId] ?? [];
  const account = accounts[0] ?? null;
  return {
    configured: account?.configured ?? false,
    connected: account?.connected ?? false,
    running: account?.running ?? false,
    account,
  };
}

export async function loadConnectors(state: ConnectorsState, probe: boolean) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.connectorsLoading) {
    return;
  }
  state.connectorsLoading = true;
  state.connectorsError = null;
  try {
    const res = await state.client.request<ChannelsStatusSnapshot | null>("channels.status", {
      probe,
      timeoutMs: 8000,
    });
    state.connectorsSnapshot = res;
  } catch (err) {
    state.connectorsError = String(err);
  } finally {
    state.connectorsLoading = false;
  }
}

export function openConnectorConfig(state: ConnectorsState, connectorId: string) {
  state.connectorsConfiguring = connectorId;
  state.connectorsFormValues = {};
  state.connectorsFormErrors = {};
  state.connectorsSaveError = null;
}

export function closeConnectorConfig(state: ConnectorsState) {
  state.connectorsConfiguring = null;
  state.connectorsFormValues = {};
  state.connectorsFormErrors = {};
  state.connectorsSaveError = null;
}

export function updateConnectorField(state: ConnectorsState, key: string, value: string) {
  state.connectorsFormValues = { ...state.connectorsFormValues, [key]: value };
  // Clear error for this field
  const errors = { ...state.connectorsFormErrors };
  delete errors[key];
  state.connectorsFormErrors = errors;
}

export function validateConnectorForm(
  state: ConnectorsState,
  definition: ConnectorDefinition,
): boolean {
  const errors: Record<string, string> = {};
  for (const field of definition.fields) {
    if (field.required) {
      const value = (state.connectorsFormValues[field.key] ?? "").trim();
      if (!value) {
        errors[field.key] = `${field.label} is required`;
      }
    }
  }
  state.connectorsFormErrors = errors;
  return Object.keys(errors).length === 0;
}
