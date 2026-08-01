// Cross-platform equivalent of:
//   rm -rf node_modules && docker run --rm -v "$PWD":/app -w /app node:20-alpine npm install --package-lock-only
// Regenerates package-lock.json using the same node/npm version the Dockerfile
// builds with, so the committed lockfile stays installable via `npm ci` in
// Docker regardless of what platform/npm version generated it. Plain shell
// syntax ($PWD, rm -rf) doesn't work under npm's default Windows script-shell
// (cmd.exe), so this runs as a node script instead.
const { rmSync } = require("fs");
const { spawnSync } = require("child_process");

rmSync("node_modules", { recursive: true, force: true });

const result = spawnSync(
  "docker",
  [
    "run",
    "--rm",
    "-v",
    `${process.cwd()}:/app`,
    "-w",
    "/app",
    "node:20-alpine",
    "npm",
    "install",
    "--package-lock-only",
  ],
  { stdio: "inherit" },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
