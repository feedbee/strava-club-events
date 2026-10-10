# Agent execution rules

Start with [docs/README.md](docs/README.md). Read architecture guidance before structural changes.

- Canonical install: `npm ci --ignore-scripts`; default checks: `npm test`.
- Production, CI and devcontainer target Node 24.21.0; the owner also permits Node 26 on the host. Do not change the production major as a side effect.
- Use only `.env` for local configuration; never read secrets into logs or commit env files.
- HTTP tests need ephemeral loopback ports; sandbox restrictions may require approved execution outside the sandbox.
- MongoDB tests require an explicit disposable `TEST_MONGODB_URI`; never run them against production.
- Historical audit/step reports describe their original verification and are not current release status.
- Release version source: `package.json`, synchronized with `package-lock.json` using npm version.
- Follow [docs/releases.md](docs/releases.md) for every release. Update the canonical `CHANGELOG.md`, create a release commit, and publish an annotated tag, Docker image and GitHub Release only when publication is authorized. Preparation alone does not authorize publication.
- Do not broaden unfinished audit work during release preparation; record remaining limitations.
