import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const commit = String(
  process.env.CF_PAGES_COMMIT_SHA ||
  process.env.RAILWAY_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  'local',
).trim();

const branch = String(
  process.env.CF_PAGES_BRANCH ||
  process.env.RAILWAY_GIT_BRANCH ||
  process.env.GITHUB_REF_NAME ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  'local',
).trim();

const payload = {
  app: 'texasnomad-games',
  commit,
  branch,
  builtAt: new Date().toISOString(),
};

await writeFile(
  join(process.cwd(), 'public', 'build-meta.json'),
  `${JSON.stringify(payload, null, 2)}\n`,
  'utf8',
);

console.log(`[TNG build] stamped ${commit} on ${branch}`);
