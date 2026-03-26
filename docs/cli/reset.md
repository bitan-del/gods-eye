---
summary: "CLI reference for `godseye reset` (reset local state/config)"
read_when:
  - You want to wipe local state while keeping the CLI installed
  - You want a dry-run of what would be removed
title: "reset"
---

# `godseye reset`

Reset local config/state (keeps the CLI installed).

```bash
godseye backup create
godseye reset
godseye reset --dry-run
godseye reset --scope config+creds+sessions --yes --non-interactive
```

Run `godseye backup create` first if you want a restorable snapshot before removing local state.
