import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { issue } from '../src/state.mjs';
import { createSupervisor } from '../src/supervisor.mjs';
import { inspectBinding, verifyBinding, LOCAL_REHEARSAL_WARNING } from '../src/verify.mjs';
import { authenticate, keypair } from '../src/crypto.mjs';
import { canonical, parseCanonical, hash } from '../src/canonical.mjs';
import { requestFor } from '../src/inference/contract.mjs';
import { proveMOCK } from '../src/inference/mock.mjs';
import { verifyChain } from '../src/chain.mjs';

// No mocked attestation or source. Both runs below launch real Chromium and
// retrieve real HTTPS bytes. Network/Chromium failures fail this suite loudly.
let root, a, b, challengeA, challengeB, envelope;
const options = { allowLocalSoftware: true, allowMockInference: true }; // inference MOCK only
before(async () => {
  root = await mkdtemp(join(tmpdir(), 'afb-test-'));
  const supervisor = createSupervisor();
  challengeA = await issue(join(root, 'issued-a'));
  a = await supervisor.attestRun(challengeA);
  challengeB = await issue(join(root, 'issued-b'));
  b = await supervisor.attestRun(challengeB);
  const inspected = await inspectBinding(a.bundle, a.policy, join(root, 'issued-a'), options);
  assert.equal(inspected.warning, LOCAL_REHEARSAL_WARNING);
  envelope = { binding: a.bundle, inference: proveMOCK(requestFor(inspected)) }; // MOCK
  console.log(`LIVE CAPTURE: two real Chromium HTTPS runs; archived=${inspected.fact.value}; no attestation/source mocks`);
}, { timeout: 180000 });
after(async () => { if (root) await rm(root, { recursive: true, force: true }); });

async function freshState() {
  const state = await mkdtemp(join(root, 'state-'));
  // Copy the actual issued challenge; no invented attestation/response.
  await writeFile(join(state, `${challengeA.nonce}.json`), canonical(challengeA));
  await writeFile(join(state, `${challengeB.nonce}.json`), canonical(challengeB));
  return state;
}
async function rejectCase(name, mutation, pattern, verifyOptions = options) {
  const changed = structuredClone(envelope); const policy = structuredClone(a.policy);
  mutation(changed, policy);
  await assert.rejects(verifyChain(changed, policy, await freshState(), verifyOptions), error => {
    assert.match(error.message, pattern); console.log(`REJECT ${name}: ${error.message}`); return true;
  });
}
test('positive: real software-attested run and independently extracted fact; inference MOCK', async () => {
  const result = await verifyChain(envelope, a.policy, await freshState(), options);
  assert.equal(result.profile, 'LOCAL_SOFTWARE'); assert.equal(result.inference, 'MOCK');
  assert.equal(result.warning, LOCAL_REHEARSAL_WARNING);
  assert.equal(result.zk_verified, false); assert.equal(result.run_sha256, a.bundle.receipt.claims.run_sha256);
  console.log('PASS positive: LOCAL REHEARSAL software binding; inference=MOCK; zk_verified=false');
});
test('positive: binding alone has no mocked dependency', async () => {
  const result = await verifyBinding(a.bundle, a.policy, await freshState(), options);
  assert.equal(result.run_sha256, a.bundle.receipt.claims.run_sha256);
  assert.equal(result.warning, LOCAL_REHEARSAL_WARNING);
});
test('REJECT changed fact value', () => rejectCase('fact value', e => {
  const fact = parseCanonical(e.binding.fact_canonical); fact.value = !fact.value; e.binding.fact_canonical = canonical(fact);
}, /fact: differs/));
test('REJECT changed fact schema', () => rejectCase('fact schema', e => {
  const fact = parseCanonical(e.binding.fact_canonical); fact.schema = 'afb.fact/2'; e.binding.fact_canonical = canonical(fact);
}, /fact: schema/));
test('REJECT changed fact field name', () => rejectCase('fact field name', e => {
  const fact = parseCanonical(e.binding.fact_canonical); fact.field = 'repository.fork'; e.binding.fact_canonical = canonical(fact);
}, /fact: schema/));
test('REJECT proof reused with another valid run under the same authority', async () => {
  authenticate('run-certificate', b.bundle.attestation, a.policy.authority_public_key);
  assert.notEqual(a.bundle.attestation.claims.run_id, b.bundle.attestation.claims.run_id);
  await rejectCase('cross-run substitution', e => { e.binding.attestation = b.bundle.attestation; }, /run-receipt: invalid signature/);
});
test('REJECT changed workload policy hash', () => rejectCase('workload mismatch', (_, p) => { p.workload_sha256 = '0'.repeat(64); }, /workload: hash mismatch/));
test('REJECT changed measured workload', () => rejectCase('workload measurement', e => { e.binding.measurement.node_version = 'v0'; }, /workload: hash mismatch/));
test('REJECT wrong prover in signed receipt', () => rejectCase('wrong prover', e => { e.binding.receipt.claims.prover_id = '0'.repeat(64); }, /run-receipt: invalid signature/));
test('REJECT wrong model policy', () => rejectCase('wrong model', (_, p) => { p.model_sha256 = '0'.repeat(64); }, /model: unapproved/));
test('REJECT wrong model in signed receipt', () => rejectCase('receipt model', e => { e.binding.receipt.claims.model_sha256 = '0'.repeat(64); }, /run-receipt: invalid signature/));
test('REJECT modified source metadata', () => rejectCase('source metadata', e => { e.binding.receipt.claims.source = 'https://example.com/'; }, /run-receipt: invalid signature/));
test('REJECT modified response bytes', () => rejectCase('response bytes', e => { e.binding.response_base64 = Buffer.from('{}').toString('base64'); }, /response: commitment mismatch/));
test('REJECT changed fact and recomputed unsigned commitment', () => rejectCase('recomputed fact commitment', e => {
  const fact = parseCanonical(e.binding.fact_canonical); fact.value = !fact.value;
  e.binding.fact_canonical = canonical(fact); e.binding.receipt.claims.fact_sha256 = hash('fact', fact);
}, /run-receipt: invalid signature/));
test('REJECT malformed canonical fact', () => rejectCase('malformed canonical fact', e => { e.binding.fact_canonical += '\n'; }, /canonical: noncanonical/));
test('REJECT untrusted authority', () => rejectCase('untrusted authority', (_, p) => { p.authority_public_key = keypair().publicKey; }, /run-certificate: invalid signature/));
test('REJECT modified certificate nonce', () => rejectCase('certificate nonce', e => { e.binding.attestation.claims.nonce = '0'.repeat(64); }, /run-certificate: invalid signature/));
test('REJECT replay / duplicate submission', async () => {
  const state = await freshState(); await verifyChain(envelope, a.policy, state, options);
  await assert.rejects(verifyChain(envelope, a.policy, state, options), /replay: nonce already consumed/);
  console.log('REJECT replay: nonce already consumed');
});
test('REJECT expired envelope with real evidence and advanced verifier clock', () => rejectCase('expired envelope', () => {}, /challenge: expired/, { ...options, now: challengeA.expires_at + 1 }));
test('REJECT unknown challenge', async () => {
  const empty = await mkdtemp(join(root, 'empty-'));
  await assert.rejects(verifyChain(envelope, a.policy, empty, options), { message: 'challenge: unknown challenge ID' });
});
test('REJECT corrupted challenge state', async () => {
  const state = await freshState(); await writeFile(join(state, `${challengeA.nonce}.json`), '{}');
  await assert.rejects(verifyChain(envelope, a.policy, state, options), /challenge: schema/);
});
test('REJECT inference MOCK without opt-in', () => rejectCase('MOCK requires opt-in', () => {}, /MOCK inference rejected/, { allowLocalSoftware: true }));
test('REJECT local software attestation when hardware required', () => rejectCase('hardware boundary', () => {}, /HARDWARE_ATTESTATION_UNAVAILABLE/, { allowMockInference: true }));
test('REJECT relabeling MOCK as EZKL', () => rejectCase('fake EZKL', e => { e.inference.kind = 'EZKL'; }, /EZKL_VERIFIER_UNAVAILABLE/));
test('REJECT changed MOCK output', () => rejectCase('MOCK output', e => { e.inference.label = 'tampered'; }, /MOCK: output/));
test('REJECT changed MOCK public input', () => rejectCase('MOCK public input', e => { e.inference.public_instances[0][0] = '999'; }, /MOCK: output/));
test('REJECT wrong inference prover identity', () => rejectCase('MOCK prover identity', e => { e.inference.prover_id = '0'.repeat(64); }, /inference: prover_id/));
test('REJECT inference response reused with wrong run', () => rejectCase('MOCK run binding', e => { e.inference.run_sha256 = b.bundle.receipt.claims.run_sha256; }, /inference: run_sha256/));
test('failed verification does not consume valid challenge', async () => {
  const state = await freshState(); const altered = structuredClone(envelope); altered.inference.label = 'tampered';
  await assert.rejects(verifyChain(altered, a.policy, state, options), /MOCK: output/);
  await verifyChain(envelope, a.policy, state, options);
});
function cliVerify(directory, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['src/cli.mjs', 'verify', '--allow-local-software', '--allow-mock-inference', ...extraArgs], { env: { ...process.env, AFB_OUTPUT_DIR: directory } });
    let output = ''; child.stdout.on('data', d => { output += d; }); child.stderr.on('data', d => { output += d; });
    child.on('error', reject); child.on('close', code => resolve({ code, output }));
  });
}
test('CLI accepts a submitted bundle only against separately supplied policy/state', async () => {
  const submitted = await mkdtemp(join(root, 'submitted-'));
  const trusted = await mkdtemp(join(root, 'trusted-'));
  const state = await freshState();
  await writeFile(join(submitted, 'bundle.json'), canonical(envelope));
  const hostilePolicy = { ...a.policy, authority_public_key: keypair().publicKey };
  await writeFile(join(submitted, 'policy.json'), canonical(hostilePolicy));
  await writeFile(join(trusted, 'policy.json'), canonical(a.policy));
  const result = await cliVerify(submitted, ['--bundle', join(submitted, 'bundle.json'), '--policy', join(trusted, 'policy.json'), '--state', state]);
  assert.equal(result.code, 0); assert.match(result.output, /PASS LOCAL REHEARSAL \(LOCAL_SOFTWARE\)/);
  assert.ok(result.output.includes(LOCAL_REHEARSAL_WARNING));
});
async function cliRunDirectory() {
  const directory = await mkdtemp(join(root, 'cli-'));
  const state = join(directory, 'state');
  await mkdir(state);
  await writeFile(join(state, `${challengeA.nonce}.json`), canonical(challengeA));
  await writeFile(join(directory, 'bundle.json'), canonical(envelope));
  await writeFile(join(directory, 'policy.json'), canonical(a.policy));
  return directory;
}
test('CLI rejects missing --policy despite a valid co-located policy, without consuming nonce', async () => {
  const directory = await cliRunDirectory();
  const rejected = await cliVerify(directory);
  assert.equal(rejected.code, 1);
  assert.equal(rejected.output.trim(), 'FAIL: policy: explicit trusted --policy path required');
  const accepted = await cliVerify(directory, ['--policy', join(directory, 'policy.json')]);
  assert.equal(accepted.code, 0); assert.ok(accepted.output.includes(LOCAL_REHEARSAL_WARNING));
  assert.match(accepted.output, /PASS LOCAL REHEARSAL/);
  console.log('REJECT implicit policy: explicit trusted --policy path required');
});
test('CLI rejects a missing explicit policy with a clean message', async () => {
  const directory = await cliRunDirectory();
  const result = await cliVerify(directory, ['--policy', join(directory, 'missing-policy.json')]);
  assert.equal(result.code, 1); assert.equal(result.output.trim(), 'FAIL: policy: file not found');
});
test('CLI rejects a missing bundle with a clean message', async () => {
  const directory = await cliRunDirectory();
  const result = await cliVerify(directory, ['--policy', join(directory, 'policy.json'), '--bundle', join(directory, 'missing-bundle.json')]);
  assert.equal(result.code, 1); assert.equal(result.output.trim(), 'FAIL: bundle: file not found');
});
test('CLI rejects an unknown challenge ID without raw ENOENT or filesystem paths', async () => {
  const directory = await cliRunDirectory();
  await rm(join(directory, 'state', `${challengeA.nonce}.json`));
  const result = await cliVerify(directory, ['--policy', join(directory, 'policy.json')]);
  assert.equal(result.code, 1); assert.equal(result.output.trim(), 'FAIL: challenge: unknown challenge ID');
  console.log('REJECT unknown challenge ID: clean verifier error');
});
test('two verifier processes racing one nonce accept exactly once', async () => {
  const directory = await cliRunDirectory();
  const args = ['--policy', join(directory, 'policy.json')];
  const results = await Promise.all([cliVerify(directory, args), cliVerify(directory, args)]);
  assert.deepEqual(results.map(r => r.code).sort(), [0, 1]);
  assert.match(results.find(r => r.code === 1).output, /replay: nonce already consumed/);
  assert.ok(results.find(r => r.code === 0).output.includes(LOCAL_REHEARSAL_WARNING));
  console.log('PASS concurrent replay: exactly one LOCAL REHEARSAL PASS and one FAIL');
});
