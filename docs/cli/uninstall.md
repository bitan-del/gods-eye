---
summary: "CLI reference for `godseye uninstall` (remove gateway service + local data)"
read_when:
  - You want to remove the gateway service and/or local state
  - You want a dry-run first
title: "uninstall"
---

# `godseye uninstall`

Uninstall the gateway service + local data (CLI remains).

```bash
godseye backup create
godseye uninstall
godseye uninstall --all --yes
godseye uninstall --dry-run
```

Run `godseye backup create` first if you want a restorable snapshot before removing state or workspaces.
