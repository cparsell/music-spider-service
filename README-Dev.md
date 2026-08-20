# Development

## Releasing

Images are published to [Docker Hub](https://hub.docker.com/r/139139/music-spider). Versioning follows [SemVer](https://semver.org/) (`vMAJOR.MINOR.PATCH`); while pre-1.0, breaking changes bump MINOR and fixes bump PATCH - 1.0.0 marks the point where the config/data format is considered stable.

`npm run dock -- <patch|minor|major|X.Y.Z>` (`scripts/release.js`) automates a release:

1. Requires a clean working tree, then runs `npm run build` as a sanity check before touching anything.
2. Bumps `"version"` in `package.json`/`package-lock.json` and commits that on its own (`Release vX.Y.Z`).
3. Tags the commit (`vX.Y.Z`).
4. Prompts for confirmation, then pushes the branch and tag, builds and pushes the Docker image under both `latest` and `vX.Y.Z`, and creates a GitHub Release (`gh release create vX.Y.Z --generate-notes`).

Pass `--yes` to skip the confirmation prompt. If you stop at the prompt, the commit and tag are already made locally - either push them yourself later, or roll back with `git tag -d vX.Y.Z && git reset --hard HEAD~1`.

`gh` (GitHub CLI) needs to be installed and authenticated for step 4; if it isn't found the script prints the manual command instead of failing the whole release.
