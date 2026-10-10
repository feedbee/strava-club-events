# Release procedure

## Sources and policy
`package.json` is authoritative; synchronize `package-lock.json` with
`npm version <version> --no-git-tag-version`. Use SemVer and annotated `vMAJOR.MINOR.PATCH` tags.
Before 1.0, an intentional compatibility/configuration change may use a minor bump with explicit upgrade notes.
`CHANGELOG.md` is the only durable release-note source. Never retag or overwrite a published release.

Docker Hub destination: `feedbee/strava-club-events`. Tag pushes trigger
`.github/workflows/build-and-publish.yml`, building `Dockerfile.build` for amd64 and arm64 on Node 24.
Full version tags are immutable by policy; major.minor and latest are moving convenience tags
(the existing metadata action treats the newest stable SemVer release as latest).
GitHub secrets `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` must already be configured by a maintainer.
GitHub Releases are created explicitly with `gh`, not automatically by the Docker workflow.
Server deployment is a separate operator action; repository Compose is for development.

## Preparation
1. Inspect the dirty tree and fetch remote tags. Verify default branch `main`, remote repository
   `feedbee/strava-club-events`, and absence of the proposed tag/release. Use HTTPS with GitHub CLI
   credentials if SSH is unavailable; never embed credentials in remotes.
2. Resolve the previous reachable version tag and inspect its full diff through the intended release.
   Read migration reports; derive notes from behavior, not only commit subjects.
3. Update manifest/lockfile, move Unreleased into `## [<version>] - YYYY-MM-DD` using the maintainer's
   date, and include upgrades, the full-version image and previous-tag comparison link.
4. Run `npm test`, relevant disposable MongoDB checks, and both production Docker builds.
   Check release-platform builds and smoke the image runtime. No compilation/lint/type gate exists.
   Inspect diffs for secrets and unrelated changes. Stop publication on failed required checks.
5. Stage exact paths and commit `chore(release): prepare v<version>`.

## Authorized publication
1. Confirm a clean tree, synchronized versions, release commit and remote state.
2. Create an annotated tag on that commit; push main and that exact tag without force.
3. Observe the tag's Actions run to completion. Record its image digest; a pushed tag alone is not success.
4. Extract the version section from CHANGELOG.md into a temporary notes file:
   `node scripts/release-notes.js <version> > /tmp/strava-release-notes.md`.
5. Create the GitHub Release using
   `gh release create v<version> --verify-tag --title v<version> --notes-file /tmp/strava-release-notes.md`.
   Inspect state before retrying an ambiguous publication; never create duplicates.
6. Verify release body/tag and Docker full-version image/digest. Report links, commits, checks and limitations.

## Deployment
Review the version's upgrade notes before replacing containers. For 0.9.0, stop old instances,
keep encryption/signing keys, verify required production settings and MongoDB connectivity, then
check `/health/live`, `/health/ready`, login, event views and logout behind the real HTTPS proxy.
Rollback after GCM writes may require new logins. Publication does not itself deploy the server.

## GitHub settings
Maintainers should make Quality Gates required for main; workflow files do not enforce branch protection.
