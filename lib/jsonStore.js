import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const locks = new Map();

/**
 * Serializes read-modify-write operations on the same file so concurrent
 * requests can't clobber each other's changes.
 */
export function withLock(filename, fn) {
  const prev = locks.get(filename) || Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(
    filename,
    next.then(
      () => {},
      () => {},
    ),
  );
  return next;
}

export async function readJsonFile(filename, fallback) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

export async function writeJsonFile(filename, data) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const filePath = path.join(DATA_DIR, filename);
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2));
  await fs.rename(tmpPath, filePath);
}
