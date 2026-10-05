import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative, resolve } from 'node:path';

const projectRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));

const INCLUDED_DIRECTORIES = [
  'src',
  'public',
  'server',
];

const INCLUDED_FILES = [
  'server.mjs',
  'package.json',
  'package-lock.json',
  'vite.config.js',
  'scripts/build-fingerprint.mjs',
  'scripts/write-build-meta.mjs',
  'scripts/restore-viral.mjs',
  'vendor/viral/VIRAL_Website_Upload.zip',
];

const EXCLUDED_RELATIVE_PATHS = new Set([
  'public/build-meta.json',
  // Prebuild restores this from the validated vendor ZIP and injects the TNG
  // bridge. Fingerprint the source ZIP + restore script + bridge instead.
  'public/viral/index.html',
]);

async function collectDirectory(directory, output) {
  const absolute = join(projectRoot, directory);
  const entries = await readdir(absolute, { withFileTypes: true });

  for (const entry of entries) {
    const child = join(absolute, entry.name);
    const rel = relative(projectRoot, child).replaceAll('\\', '/');

    if (EXCLUDED_RELATIVE_PATHS.has(rel)) continue;

    if (entry.isDirectory()) {
      await collectDirectory(rel, output);
      continue;
    }

    if (entry.isFile()) output.push(rel);
  }
}

export async function buildFingerprint() {
  const paths = [];

  for (const directory of INCLUDED_DIRECTORIES) {
    await collectDirectory(directory, paths);
  }

  for (const path of INCLUDED_FILES) {
    if (!EXCLUDED_RELATIVE_PATHS.has(path)) {
      try {
        const info = await stat(join(projectRoot, path));
        if (info.isFile()) paths.push(path);
      } catch {}
    }
  }

  const uniquePaths = [...new Set(paths)].sort();
  const hash = createHash('sha256');

  for (const path of uniquePaths) {
    const body = await readFile(join(projectRoot, path));
    hash.update(path);
    hash.update('\0');
    hash.update(body);
    hash.update('\0');
  }

  return {
    fingerprint: hash.digest('hex'),
    files: uniquePaths.length,
  };
}
