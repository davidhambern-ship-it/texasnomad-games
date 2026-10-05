import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';

const root = process.cwd();
const zipPath = path.join(root, 'vendor', 'viral', 'VIRAL_Website_Upload.zip');
const outputDir = path.join(root, 'public', 'viral');
const outputPath = path.join(outputDir, 'index.html');

const EXPECTED_ZIP_SHA256 = '448e9cd5a1cbcbdb993cea228572d43d878b5c937abc4e81d0a58871e207c295';
const EXPECTED_HTML_SHA256 = 'b863db6af0162f939a0c415d6ceb925f9de602f0219a31e6d1f4adc77db2ca02';
const EXPECTED_HTML_BYTES = 707298;
const TARGET_ENTRY = 'viral/index.html';

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

const zip = fs.readFileSync(zipPath);
const zipSha = sha256(zip);
if (zipSha !== EXPECTED_ZIP_SHA256) {
  throw new Error(`VIRAL source ZIP integrity check failed: ${zipSha}`);
}

let offset = 0;
let html = null;

while (offset + 30 <= zip.length) {
  const signature = zip.readUInt32LE(offset);
  if (signature === 0x02014b50 || signature === 0x06054b50) break;
  if (signature !== 0x04034b50) {
    throw new Error(`Unexpected VIRAL ZIP signature at byte ${offset}: 0x${signature.toString(16)}`);
  }

  const flags = zip.readUInt16LE(offset + 6);
  const method = zip.readUInt16LE(offset + 8);
  const compressedSize = zip.readUInt32LE(offset + 18);
  const uncompressedSize = zip.readUInt32LE(offset + 22);
  const nameLength = zip.readUInt16LE(offset + 26);
  const extraLength = zip.readUInt16LE(offset + 28);
  const nameStart = offset + 30;
  const nameEnd = nameStart + nameLength;
  const dataStart = nameEnd + extraLength;
  const dataEnd = dataStart + compressedSize;
  const name = zip.subarray(nameStart, nameEnd).toString('utf8');

  if (flags & 0x08) throw new Error('VIRAL ZIP uses unsupported data descriptors.');

  if (name === TARGET_ENTRY) {
    const compressed = zip.subarray(dataStart, dataEnd);
    if (method === 0) html = Buffer.from(compressed);
    else if (method === 8) html = inflateRawSync(compressed);
    else throw new Error(`Unsupported VIRAL ZIP compression method: ${method}`);

    if (html.length !== uncompressedSize) {
      throw new Error(`VIRAL ZIP size mismatch: expected ${uncompressedSize}, got ${html.length}`);
    }
    break;
  }

  offset = dataEnd;
}

if (!html) throw new Error(`Could not find ${TARGET_ENTRY} in VIRAL source ZIP.`);
if (html.length !== EXPECTED_HTML_BYTES) {
  throw new Error(`VIRAL HTML byte count changed: expected ${EXPECTED_HTML_BYTES}, got ${html.length}`);
}

const htmlSha = sha256(html);
if (htmlSha !== EXPECTED_HTML_SHA256) {
  throw new Error(`VIRAL HTML integrity check failed: ${htmlSha}`);
}

const bridgeTag = '<script src="/viral/tng-bridge.js"></script>';
const sourceHtml = html.toString('utf8');
if (!sourceHtml.includes('</body>')) {
  throw new Error('VIRAL HTML is missing </body>; refusing to inject the TNG bridge.');
}

const legacyRelay = "return 'wss://tng-live-production.up.railway.app';";
if (!sourceHtml.includes(legacyRelay)) {
  throw new Error('VIRAL HTML relay bootstrap changed; refusing to apply an unverified TNG relay patch.');
}

const tngRelayHtml = sourceHtml.replace(
  legacyRelay,
  "return 'wss://auth.texasnomadgames.com';",
);
const deployedHtml = tngRelayHtml.replace('</body>', `${bridgeTag}</body>`);

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, deployedHtml);
console.log(`[VIRAL] Restored validated Claude build: ${html.length} source bytes, sha256 ${htmlSha}; TNG bridge injected into deployed copy.`);
