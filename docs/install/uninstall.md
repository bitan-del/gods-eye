---
summary: "Uninstall Gods Eye completely (CLI, service, state, workspace)"
read_when:
  - You want to remove Gods Eye from a machine
  - The gateway service is still running after uninstall
title: "Uninstall"
---

# Uninstall

Two paths:

- **Easy path** if `godseye` is still installed.
- **Manual service removal** if the CLI is gone but the service is still running.

## Easy path (CLI still installed)

Recommended: use the built-in uninstaller:

```bash
godseye uninstall
```

Non-interactive (automation / npx):

```bash
godseye uninstall --all --yes --non-interactive
npx -y godseye uninstall --all --yes --non-interactive
```

Manual steps (same result):

1. Stop the gateway service:

```bash
godseye gateway stop
```

2. Uninstall the gateway service (launchd/systemd/schtasks):

```bash
godseye gateway uninstall
```

3. Delete state + config:

```bash
rm -rf "${GODSEYE_STATE_DIR:-$HOME/.godseye}"
```

If you set `GODSEYE_CONFIG_PATH` to a custom location outside the state dir, delete that file too.

4. Delete your workspace (optional, removes agent files):

```bash
rm -rf ~/.godseye/workspace
```

5. Remove the CLI install (pick the one you used):

```bash
npm rm -g godseye
pnpm remove -g godseye
bun remove -g godseye
```

6. If you installed the macOS app:

```bash
rm -rf /Applications/Gods Eye.app
```

Notes:

- If you used profiles (`--profile` / `GODSEYE_PROFILE`), repeat step 3 for each state dir (defaults are `~/.godseye-<profile>`).
- In remote mode, the state dir lives on the **gateway host**, so run steps 1-4 there too.

## Manual service removal (CLI not installed)

Use this if the gateway service keeps running but `godseye` is missing.

### macOS (launchd)

Default label is `ai.godseye.gateway` (or `ai.godseye.<profile>`; legacy `com.godseye.*` may still exist):

```bash
launchctl bootout gui/$UID/ai.godseye.gateway
rm -f ~/Library/LaunchAgents/ai.godseye.gateway.plist
```

If you used a profile, replace the label and plist name with `ai.godseye.<profile>`. Remove any legacy `com.godseye.*` plists if present.

### Linux (systemd user unit)

Default unit name is `godseye-gateway.service` (or `godseye-gateway-<profile>.service`):

```bash
systemctl --user disable --now godseye-gateway.service
rm -f ~/.config/systemd/user/godseye-gateway.service
systemctl --user daemon-reload
```

### Windows (Scheduled Task)

Default task name is `Gods Eye Gateway` (or `Gods Eye Gateway (<profile>)`).
The task script lives under your state dir.

```powershell
schtasks /Delete /F /TN "Gods Eye Gateway"
Remove-Item -Force "$env:USERPROFILE\.godseye\gateway.cmd"
```

If you used a profile, delete the matching task name and `~\.godseye-<profile>\gateway.cmd`.

## Normal install vs source checkout

### Normal install (install.sh / npm / pnpm / bun)

If you used `https://gods-eye.org/install.sh` or `install.ps1`, the CLI was installed with `npm install -g godseye@latest`.
Remove it with `npm rm -g godseye` (or `pnpm remove -g` / `bun remove -g` if you installed that way).

### Source checkout (git clone)

If you run from a repo checkout (`git clone` + `godseye ...` / `bun run godseye ...`):

1. Uninstall the gateway service **before** deleting the repo (use the easy path above or manual service removal).
2. Delete the repo directory.
3. Remove state + workspace as shown above.
