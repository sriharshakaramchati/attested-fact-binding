import { canonical, parseCanonical, exact, requireThat, decode64, hash, hex } from './canonical.mjs';
import { authenticate } from './crypto.mjs';
import { SOURCE, MODEL_HASH, validateFact, extract, inputHash, checkModel } from './policy.mjs';
import { checkChallenge, consume } from './state.mjs';
import { requireHardwareAttestation } from './attestation/hardware.mjs';

// Read-only cryptographic inspection is not acceptance: callers must consume the
// challenge atomically. CLI acceptance always goes through verifyBinding/verifyChain.
export async function inspectBinding(bundle, policy, stateDirectory, { allowLocalSoftware = false, now = Math.floor(Date.now() / 1000) } = {}) {
  exact(bundle, ['version', 'measurement', 'attestation', 'receipt', 'fact_canonical', 'response_base64'], 'bundle');
  exact(policy, ['version', 'profile', 'authority_public_key', 'workload_sha256', 'model_sha256'], 'policy');
  requireThat(bundle.version === 1 && policy.version === 1, 'version mismatch');
  if (!allowLocalSoftware || policy.profile !== 'LOCAL_SOFTWARE') requireHardwareAttestation();
  const run = authenticate('run-certificate', bundle.attestation, policy.authority_public_key);
  exact(run, ['version', 'profile', 'audience', 'nonce', 'run_id', 'issued_at', 'expires_at', 'workload_sha256', 'run_public_key'], 'run');
  requireThat(run.version === 1 && run.profile === policy.profile && run.audience === 'afb-verifier/1', 'run: profile or audience mismatch');
  requireThat(hex(policy.workload_sha256) && run.workload_sha256 === policy.workload_sha256 && hash('workload', bundle.measurement) === policy.workload_sha256, 'workload: hash mismatch');
  requireThat(policy.model_sha256 === MODEL_HASH, 'model: unapproved identity');
  checkModel();
  const challenge = await checkChallenge(stateDirectory, run, now);
  const receipt = authenticate('run-receipt', bundle.receipt, run.run_public_key);
  exact(receipt, ['version', 'run_sha256', 'run_id', 'nonce', 'workload_sha256', 'prover_id', 'model_sha256', 'fact_sha256', 'input_sha256', 'response_sha256', 'timestamp_s', 'source', 'method', 'status', 'tls_protocol', 'browser_version'], 'receipt');
  requireThat(receipt.version === 1 && receipt.run_sha256 === hash('run', run) && receipt.run_id === run.run_id && receipt.nonce === run.nonce, 'binding: wrong run or nonce');
  requireThat(receipt.workload_sha256 === policy.workload_sha256, 'binding: wrong workload');
  requireThat(receipt.prover_id === hash('run-key', run.run_public_key), 'binding: wrong prover identity');
  requireThat(receipt.model_sha256 === policy.model_sha256, 'binding: wrong model identity');
  requireThat(Number.isSafeInteger(receipt.timestamp_s) && receipt.timestamp_s >= challenge.issued_at && receipt.timestamp_s <= challenge.expires_at && receipt.timestamp_s <= now + 30, 'receipt: expired or invalid timestamp');
  requireThat(receipt.source === SOURCE && receipt.method === 'GET' && receipt.status === 200 && typeof receipt.tls_protocol === 'string' && /^TLS 1\.[23]$/.test(receipt.tls_protocol) && typeof receipt.browser_version === 'string', 'receipt: source or TLS policy mismatch');
  const body = decode64(bundle.response_base64);
  requireThat(hash('response', body) === receipt.response_sha256, 'response: commitment mismatch');
  const fact = parseCanonical(bundle.fact_canonical); validateFact(fact);
  requireThat(canonical(extract(body)) === bundle.fact_canonical, 'fact: differs from signed source response');
  requireThat(hash('fact', fact) === receipt.fact_sha256, 'fact: commitment mismatch');
  requireThat(inputHash(fact) === receipt.input_sha256, 'input: hash mismatch');
  return { profile: 'LOCAL_SOFTWARE', fact, run_sha256: receipt.run_sha256, input_sha256: receipt.input_sha256, model_sha256: receipt.model_sha256, prover_id: receipt.prover_id };
}
export async function verifyBinding(bundle, policy, stateDirectory, options) {
  const result = await inspectBinding(bundle, policy, stateDirectory, options);
  await consume(stateDirectory, bundle.attestation.claims.nonce); return result;
}
