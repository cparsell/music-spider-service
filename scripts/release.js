// Automates the release steps:
// 1. bump the version,
// 2. commit + tag it, then (after confirming)
// 3. push, build/push the Docker image under both `latest` and the version tag
// 4. cut a GitHub Release.
//
// Plain node (not bash) so this also runs under Windows, same
// reasoning as scripts/lock.js.
//
// Usage:
//   node scripts/release.js <patch|minor|major|X.Y.Z> [--yes]
//
// --yes skips the confirmation prompt before pushing/publishing.

const { readFileSync, writeFileSync } = require("fs");
const { spawnSync } = require("child_process");
const readline = require("readline");

const DOCKER_IMAGE = "139139/music-spider";

function run(cmd, args, opts = {}) {
  let result = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (
    result.error &&
    (result.error.code === "ENOENT" || result.error.code === "EINVAL")
  ) {
    result = spawnSync(cmd, args, { stdio: "inherit", shell: true, ...opts });
  }
  if (result.error) {
    if (result.error.code === "ENOENT") return { ok: false, missing: true };
    throw result.error;
  }
  return { ok: result.status === 0, status: result.status };
}

function runCapture(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: "utf8" });
  return (result.stdout || "").trim();
}

function bumpVersion(current, bump) {
  if (/^\d+\.\d+\.\d+$/.test(bump)) return bump;
  const m = current.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) throw new Error(`Unexpected version in package.json: ${current}`);
  let [major, minor, patch] = m.slice(1).map(Number);
  if (bump === "major") {
    major++;
    minor = 0;
    patch = 0;
  } else if (bump === "minor") {
    minor++;
    patch = 0;
  } else if (bump === "patch") {
    patch++;
  } else {
    throw new Error(
      `Expected "patch", "minor", "major", or an explicit X.Y.Z version, got "${bump}"`,
    );
  }
  return `${major}.${minor}.${patch}`;
}

function setVersion(newVersion) {
  const pkgRaw = readFileSync("package.json", "utf8");
  const pkg = JSON.parse(pkgRaw);
  const oldVersion = pkg.version;
  writeFileSync(
    "package.json",
    pkgRaw.replace(`"version": "${oldVersion}"`, `"version": "${newVersion}"`),
  );

  // Hand-edit just the two version fields rather than running `npm install
  // --package-lock-only` - that re-resolves the whole dependency tree and
  // produces unrelated churn (see git history for why this was reverted once
  // already).
  const lockRaw = readFileSync("package-lock.json", "utf8");
  const updatedLock = lockRaw.replace(
    new RegExp(`"version": "${oldVersion}"`, "g"),
    `"version": "${newVersion}"`,
  );
  writeFileSync("package-lock.json", updatedLock);

  return oldVersion;
}

async function confirm(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await new Promise((resolve) =>
    rl.question(`${question} [y/N] `, resolve),
  );
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

async function main() {
  const args = process.argv.slice(2);
  const skipConfirm = args.includes("--yes") || args.includes("-y");
  const bump = args.find((a) => !a.startsWith("-"));

  if (!bump) {
    console.error(
      "Usage: node scripts/release.js <patch|minor|major|X.Y.Z> [--yes]",
    );
    process.exit(1);
  }

  const status = runCapture("git", ["status", "--porcelain"]);
  if (status) {
    console.error(
      "Working tree isn't clean. Commit or stash your changes first so the release commit only contains the version bump.",
    );
    process.exit(1);
  }

  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const newVersion = bumpVersion(pkg.version, bump);
  const tag = `v${newVersion}`;

  console.log(`Bumping version: ${pkg.version} -> ${newVersion}`);

  const build = run("npm", ["run", "build"]);
  if (!build.ok) {
    console.error("Build failed - aborting before touching version/git state.");
    process.exit(1);
  }

  setVersion(newVersion);
  run("git", ["add", "package.json", "package-lock.json"]);
  const commit = run("git", ["commit", "-m", `Release ${tag}`]);
  if (!commit.ok) {
    console.error("git commit failed - aborting.");
    process.exit(1);
  }
  const tagResult = run("git", ["tag", tag]);
  if (!tagResult.ok) {
    console.error(
      `git tag failed (does ${tag} already exist?) - the release commit is still local, roll it back with "git reset --hard HEAD~1" if needed.`,
    );
    process.exit(1);
  }

  console.log(`\nCommitted and tagged ${tag} locally.`);

  const proceed =
    skipConfirm ||
    (await confirm(
      `\nPush ${tag} to origin, build/push Docker image "${DOCKER_IMAGE}:latest" and "${DOCKER_IMAGE}:${tag}", and create a GitHub Release?`,
    ));

  if (!proceed) {
    console.log(
      `\nStopped here. The commit and tag are local-only. To finish manually:\n` +
        `  git push origin HEAD && git push origin ${tag}\n` +
        `  docker build -t ${DOCKER_IMAGE}:latest -t ${DOCKER_IMAGE}:${tag} .\n` +
        `  docker push ${DOCKER_IMAGE}:latest && docker push ${DOCKER_IMAGE}:${tag}\n` +
        `  gh release create ${tag} --generate-notes\n` +
        `To undo instead: git tag -d ${tag} && git reset --hard HEAD~1`,
    );
    return;
  }

  const branch = runCapture("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  console.log(`\nPushing ${branch} and ${tag}...`);
  if (!run("git", ["push", "origin", branch]).ok) {
    console.error("git push failed - stopping before Docker/GitHub steps.");
    process.exit(1);
  }
  if (!run("git", ["push", "origin", tag]).ok) {
    console.error(
      "git push (tag) failed - stopping before Docker/GitHub steps.",
    );
    process.exit(1);
  }

  console.log("\nBuilding Docker image...");
  const dockerBuild = run("docker", [
    "build",
    "-t",
    `${DOCKER_IMAGE}:latest`,
    "-t",
    `${DOCKER_IMAGE}:${tag}`,
    ".",
  ]);
  if (dockerBuild.missing) {
    console.error("docker not found - skipping image build/push.");
  } else if (!dockerBuild.ok) {
    console.error("docker build failed - skipping push.");
    process.exit(1);
  } else {
    console.log("Pushing Docker image...");
    run("docker", ["push", `${DOCKER_IMAGE}:latest`]);
    run("docker", ["push", `${DOCKER_IMAGE}:${tag}`]);
  }

  console.log("\nCreating GitHub Release...");
  const ghRelease = run("gh", ["release", "create", tag, "--generate-notes"]);
  if (ghRelease.missing) {
    console.error(
      `gh CLI not found - create the release manually: gh release create ${tag} --generate-notes (or via the GitHub UI).`,
    );
  }

  console.log(`\nDone: ${tag} released.`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
