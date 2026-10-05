import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildFingerprint } from './build-fingerprint.mjs';

const commit = String(
  process.env.CF_PAGES_COMMIT_SHA ||
  process.env.RAILWAY_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  '',
).trim();

const branch = String(
  process.env.CF_PAGES_BRANCH ||
  process.env.RAILWAY_GIT_BRANCH ||
  process.env.GITHUB_REF_NAME ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  '',
).trim();

const { fingerprint, files } = await buildFingerprint();

const payload = {
  app: 'texasnomad-games',
  fingerprint,
  files,
  commit: commit || null,
  branch: branch || null,
  builtAt: new Date().toISOString(),
};

await writeFile(
  join(process.cwd(), 'public', 'build-meta.json'),
  `${JSON.stringify(payload, null, 2)}\n`,
  'utf8',
);

console.log(
  `[TNG build] fingerprint ${fingerprint.slice(0, 12)} from ${files} files`
  + (commit ? `; commit ${commit.slice(0, 12)}` : ''),
);
