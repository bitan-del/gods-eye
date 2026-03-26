---
summary: "CLI reference for `godseye logs` (tail gateway logs via RPC)"
read_when:
  - You need to tail Gateway logs remotely (without SSH)
  - You want JSON log lines for tooling
title: "logs"
---

# `godseye logs`

Tail Gateway file logs over RPC (works in remote mode).

Related:

- Logging overview: [Logging](/logging)

## Examples

```bash
godseye logs
godseye logs --follow
godseye logs --json
godseye logs --limit 500
godseye logs --local-time
godseye logs --follow --local-time
```

Use `--local-time` to render timestamps in your local timezone.
