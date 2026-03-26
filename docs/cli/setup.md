---
summary: "CLI reference for `godseye setup` (initialize config + workspace)"
read_when:
  - You’re doing first-run setup without full CLI onboarding
  - You want to set the default workspace path
title: "setup"
---

# `godseye setup`

Initialize `~/.godseye/godseye.json` and the agent workspace.

Related:

- Getting started: [Getting started](/start/getting-started)
- CLI onboarding: [Onboarding (CLI)](/start/wizard)

## Examples

```bash
godseye setup
godseye setup --workspace ~/.godseye/workspace
```

To run onboarding via setup:

```bash
godseye setup --wizard
```
