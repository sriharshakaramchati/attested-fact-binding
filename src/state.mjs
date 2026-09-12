import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, open } from 'node:fs/promises';
import { join } from 'node:path';
import { canonical, parseCanonical, requireThat, exact, hex } from './canonical.mjs';
export async function issue(directory, now = Math.floor(Date.now() / 1000)) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const challenge = { version: 1, nonce: randomBytes(32).toString('hex'), run_id: randomBytes(32).toString('hex'), issued_at: now, expires_at: now + 600 };
  await writeFile(join(directory, `${challenge.nonce}.json`), canonical(challenge), { flag: 'wx', mode: 0o600 });
  return challenge;
}
export async function checkChallenge(directory, claims, now) {
  requireThat(hex(claims.nonce), 'challenge: invalid nonce');
  const challenge = parseCanonical(await readFile(join(directory, `${claims.nonce}.json`), 'utf8'));
  exact(challenge, ['version', 'nonce', 'run_id', 'issued_at', 'expires_at'], 'challenge');
  requireThat(challenge.version === 1 && hex(challenge.run_id), 'challenge: invalid state');
  for (const key of ['nonce', 'run_id', 'issued_at', 'expires_at']) requireThat(claims[key] === challenge[key], `challenge: ${key} mismatch`);
  requireThat(Number.isSafeInteger(now) && Number.isSafeInteger(challenge.issued_at) && Number.isSafeInteger(challenge.expires_at), 'challenge: invalid time');
  requireThat(challenge.expires_at - challenge.issued_at === 600 && now >= challenge.issued_at - 30 && now <= challenge.expires_at, 'challenge: expired or future');
  return challenge;
}
export async function consume(directory, nonce) {
  requireThat(hex(nonce), 'challenge: invalid nonce');
  // Atomic O_EXCL is the linearization point. Never remove accepted markers.
  let file;
  try { file = await open(join(directory, `${nonce}.used`), 'wx', 0o600); }
  catch (e) { if (e.code === 'EEXIST') throw new Error('replay: nonce already consumed'); throw e; }
  try { await file.writeFile('consumed\n'); await file.sync(); } finally { await file.close(); }
  const dir = await open(directory, 'r');
  try { await dir.sync(); } finally { await dir.close(); }
}
