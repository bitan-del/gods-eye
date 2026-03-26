# @godseye/voice-call

Official Voice Call plugin for **Gods Eye**.

Providers:

- **Twilio** (Programmable Voice + Media Streams)
- **Telnyx** (Call Control v2)
- **Plivo** (Voice API + XML transfer + GetInput speech)
- **Mock** (dev/no network)

Docs: `https://docs.gods-eye.org/plugins/voice-call`
Plugin system: `https://docs.gods-eye.org/plugin`

## Install (local dev)

### Option A: install via Gods Eye (recommended)

```bash
godseye plugins install @godseye/voice-call
```

Restart the Gateway afterwards.

### Option B: copy into your global extensions folder (dev)

```bash
mkdir -p ~/.godseye/extensions
cp -R extensions/voice-call ~/.godseye/extensions/voice-call
cd ~/.godseye/extensions/voice-call && pnpm install
```

## Config

Put under `plugins.entries.voice-call.config`:

```json5
{
  provider: "twilio", // or "telnyx" | "plivo" | "mock"
  fromNumber: "+15550001234",
  toNumber: "+15550005678",

  twilio: {
    accountSid: "ACxxxxxxxx",
    authToken: "your_token",
  },

  telnyx: {
    apiKey: "KEYxxxx",
    connectionId: "CONNxxxx",
    // Telnyx webhook public key from the Telnyx Mission Control Portal
    // (Base64 string; can also be set via TELNYX_PUBLIC_KEY).
    publicKey: "...",
  },

  plivo: {
    authId: "MAxxxxxxxxxxxxxxxxxxxx",
    authToken: "your_token",
  },

  // Webhook server
  serve: {
    port: 3334,
    path: "/voice/webhook",
  },

  // Public exposure (pick one):
  // publicUrl: "https://example.ngrok.app/voice/webhook",
  // tunnel: { provider: "ngrok" },
  // tailscale: { mode: "funnel", path: "/voice/webhook" }

  outbound: {
    defaultMode: "notify", // or "conversation"
  },

  streaming: {
    enabled: true,
    streamPath: "/voice/stream",
    preStartTimeoutMs: 5000,
    maxPendingConnections: 32,
    maxPendingConnectionsPerIp: 4,
    maxConnections: 128,
  },
}
```

Notes:

- Twilio/Telnyx/Plivo require a **publicly reachable** webhook URL.
- `mock` is a local dev provider (no network calls).
- Telnyx requires `telnyx.publicKey` (or `TELNYX_PUBLIC_KEY`) unless `skipSignatureVerification` is true.
- advanced webhook, streaming, and tunnel notes: `https://docs.gods-eye.org/plugins/voice-call`

## Stale call reaper

See the plugin docs for recommended ranges and production examples:
`https://docs.gods-eye.org/plugins/voice-call#stale-call-reaper`

## TTS for calls

Voice Call uses the core `messages.tts` configuration for
streaming speech on calls. Override examples and provider caveats live here:
`https://docs.gods-eye.org/plugins/voice-call#tts-for-calls`

## CLI

```bash
godseye voicecall call --to "+15555550123" --message "Hello from Gods Eye"
godseye voicecall continue --call-id <id> --message "Any questions?"
godseye voicecall speak --call-id <id> --message "One moment"
godseye voicecall end --call-id <id>
godseye voicecall status --call-id <id>
godseye voicecall tail
godseye voicecall expose --mode funnel
```

## Tool

Tool name: `voice_call`

Actions:

- `initiate_call` (message, to?, mode?)
- `continue_call` (callId, message)
- `speak_to_user` (callId, message)
- `end_call` (callId)
- `get_status` (callId)

## Gateway RPC

- `voicecall.initiate` (to?, message, mode?)
- `voicecall.continue` (callId, message)
- `voicecall.speak` (callId, message)
- `voicecall.end` (callId)
- `voicecall.status` (callId)

## Notes

- Uses webhook signature verification for Twilio/Telnyx/Plivo.
- Adds replay protection for Twilio and Plivo webhooks (valid duplicate callbacks are ignored safely).
- Twilio speech turns include a per-turn token so stale/replayed callbacks cannot complete a newer turn.
- `responseModel` / `responseSystemPrompt` control AI auto-responses.
- Voice-call auto-responses enforce a spoken JSON contract (`{"spoken":"..."}`) and filter reasoning/meta output before playback.
- While a Twilio stream is active, playback does not fall back to TwiML `<Say>`; stream-TTS failures fail the playback request.
- Outbound conversation calls suppress barge-in only while the initial greeting is actively speaking, then re-enable normal interruption.
- Twilio stream disconnect auto-end uses a short grace window so quick reconnects do not end the call.
- Media streaming requires `ws` and OpenAI Realtime API key.
