import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonical } from '../src/canonical.mjs';
import { issue, checkChallenge, consume } from '../src/state.mjs';

// Exercise the real challenge validator independently of signatures. Changing
// both the stored record and matching claims must not bypass duration/skew
// rules. These are state tests, not fabricated attestation success fixtures.
let state;
const now = 1800000000;
beforeEach(async () => { state = await mkdtemp(join(tmpdir(), 'afb-state-')); });
afterEach(async () => { await rm(state, { recursive: true, force: true }); });

test('challenge accepts the exact 30-second skew and expiration boundaries', async () => {
  const challenge = await issue(state, now);
  await checkChallenge(state, challenge, now - 30);
  await checkChallenge(state, challenge, now + 600);
});
test('REJECT future-dated issued challenge at 31 seconds', async () => {
  const challenge = await issue(state, now + 31);
  await assert.rejects(checkChallenge(state, challenge, now), { message: 'challenge: issued in future' });
});
test('REJECT expired issued challenge one second beyond its window', async () => {
  const challenge = await issue(state, now - 601);
  await assert.rejects(checkChallenge(state, challenge, now), { message: 'challenge: expired' });
});
for (const duration of [-1, 0, 599, 601, 1200]) {
  test(`REJECT matching but invalid validity window of ${duration} seconds`, async () => {
    const challenge = await issue(state, now);
    challenge.expires_at = challenge.issued_at + duration;
    await writeFile(join(state, `${challenge.nonce}.json`), canonical(challenge));
    await assert.rejects(checkChallenge(state, challenge, now), { message: 'challenge: invalid validity window' });
  });
}
test('REJECT valid-looking unknown challenge ID in an existing state directory', async () => {
  const challenge = await issue(state, now);
  await rm(join(state, `${challenge.nonce}.json`));
  await assert.rejects(checkChallenge(state, challenge, now), { message: 'challenge: unknown challenge ID' });
});
test('REJECT missing challenge state directory cleanly', async () => {
  const challenge = await issue(state, now);
  await rm(state, { recursive: true });
  await assert.rejects(checkChallenge(state, challenge, now), { message: 'challenge: unknown challenge ID' });
  await assert.rejects(consume(state, challenge.nonce), { message: 'challenge: replay state unavailable' });
});
test('REJECT a non-directory challenge path cleanly', async () => {
  const challenge = await issue(state, now);
  const file = join(state, 'not-a-directory'); await writeFile(file, '');
  await assert.rejects(checkChallenge(file, challenge, now), { message: 'challenge: unknown challenge ID' });
});
