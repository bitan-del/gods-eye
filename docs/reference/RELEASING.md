---
title: "Release Policy"
summary: "Public release channels, version naming, and cadence"
read_when:
  - Looking for public release channel definitions
  - Looking for version naming and cadence
---

# Release Policy

Gods Eye has three public release lanes:

- stable: tagged releases that publish to npm `latest`
- beta: prerelease tags that publish to npm `beta`
- dev: the moving head of `main`

## Version naming

- Stable release version: `YYYY.M.D`
  - Git tag: `vYYYY.M.D`
- Stable correction release version: `YYYY.M.D-N`
  - Git tag: `vYYYY.M.D-N`
- Beta prerelease version: `YYYY.M.D-beta.N`
  - Git tag: `vYYYY.M.D-beta.N`
- Do not zero-pad month or day
- `latest` means the current stable npm release
- `beta` means the current prerelease npm release
- Stable correction releases also publish to npm `latest`
- Every Gods Eye release ships the npm package and macOS app together

## Release cadence

- Releases move beta-first
- Stable follows only after the latest beta is validated
- Detailed release procedure, approvals, credentials, and recovery notes are
  maintainer-only

## Release preflight

- Run `pnpm build` before `pnpm release:check` so the expected `dist/*` release
  artifacts exist for the pack validation step
- Run `pnpm release:check` before every tagged release
- Run `RELEASE_TAG=vYYYY.M.D node --import tsx scripts/godseye-npm-release-check.ts`
  (or the matching beta/correction tag) before approval
- After npm publish, run
  `node --import tsx scripts/godseye-npm-postpublish-verify.ts YYYY.M.D`
  (or the matching beta/correction version) to verify the published registry
  install path in a fresh temp prefix
- For stable correction releases like `YYYY.M.D-N`, the post-publish verifier
  also checks the same temp-prefix upgrade path from `YYYY.M.D` to `YYYY.M.D-N`
  so release corrections cannot silently leave older global installs on the
  base stable payload
- npm release preflight fails closed unless the tarball includes both
  `dist/control-ui/index.html` and a non-empty `dist/control-ui/assets/` payload
  so we do not ship an empty browser dashboard again
- Stable macOS release readiness also includes the updater surfaces:
  - the GitHub release must end up with the packaged `.zip`, `.dmg`, and `.dSYM.zip`
  - `appcast.xml` on `main` must point at the new stable zip after publish
  - the packaged app must keep a non-debug bundle id, a non-empty Sparkle feed
    URL, and a `CFBundleVersion` at or above the canonical Sparkle build floor
    for that release version

## Public references

- [`.github/workflows/godseye-npm-release.yml`](https://github.com/bitan-del/gods-eye/blob/main/.github/workflows/godseye-npm-release.yml)
- [`scripts/godseye-npm-release-check.ts`](https://github.com/bitan-del/gods-eye/blob/main/scripts/godseye-npm-release-check.ts)
- [`scripts/package-mac-dist.sh`](https://github.com/bitan-del/gods-eye/blob/main/scripts/package-mac-dist.sh)
- [`scripts/make_appcast.sh`](https://github.com/bitan-del/gods-eye/blob/main/scripts/make_appcast.sh)

Maintainers use the private release docs in
[`godseye/maintainers/release/README.md`](https://github.com/bitan-del/maintainers/blob/main/release/README.md)
for the actual runbook.
