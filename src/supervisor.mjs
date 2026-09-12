import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from './browser.mjs';
import { capture } from './capture.mjs';
import { canonical, hash, sha256 } from './canonical.mjs';
import { keypair, signed } from './crypto.mjs';
import { SOURCE, MODEL_HASH, extract, inputHash, checkModel } from './policy.mjs';

export async function measure() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const files = {};
  async function walk(dir) {
    for (const item of (await readdir(join(root, dir), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = `${dir}/${item.name}`;
      if (item.isDirectory()) await walk(relative);
      else files[relative] = sha256(await readFile(join(root, relative)));
    }
  }
  await walk('src');
  checkModel();
  files['model/classifier.onnx'] = MODEL_HASH;
  files['package-lock.json'] = sha256(await readFile(join(root, 'package-lock.json')));
  const executablePath = chromium.executablePath();
  const measurement = { version: 1, files, node_version: process.version, node_sha256: sha256(await readFile(process.execPath)), chromium_sha256: sha256(await readFile(executablePath)) };
  return { executablePath, measurement, workloadHash: hash('workload', measurement) };
}

// LOCAL_SOFTWARE: real software attestation by a trusted supervisor, not a TEE
// simulation. Neither authority nor per-run private key leaves this process.
// A malicious supervisor/host can lie; consumers must approve the authority.
export async function attestRun(challenge) {
  return createSupervisor().attestRun(challenge);
}
export function createSupervisor() {
  const authority = keypair();
  return { async attestRun(challenge) {
  const run = keypair();
  const { executablePath, measurement, workloadHash } = await measure();
  const observed = await capture(executablePath);
  const fact = extract(observed.body);
  const claims = { ...challenge, profile: 'LOCAL_SOFTWARE', audience: 'afb-verifier/1', workload_sha256: workloadHash, run_public_key: run.publicKey };
  const runHash = hash('run', claims);
  const receipt = {
    version: 1, run_sha256: runHash, run_id: claims.run_id, nonce: claims.nonce,
    workload_sha256: workloadHash, prover_id: hash('run-key', run.publicKey), model_sha256: MODEL_HASH,
    fact_sha256: hash('fact', fact), input_sha256: inputHash(fact), response_sha256: hash('response', observed.body),
    timestamp_s: Math.floor(Date.now() / 1000), source: SOURCE, method: 'GET', status: 200,
    tls_protocol: observed.tlsProtocol, browser_version: observed.browserVersion
  };
  return {
    // This separately delivered policy is an explicit local trust bootstrap.
    // A remote verifier MUST NOT adopt it just because the prover supplies it.
    policy: { version: 1, profile: 'LOCAL_SOFTWARE', authority_public_key: authority.publicKey, workload_sha256: workloadHash, model_sha256: MODEL_HASH },
    bundle: { version: 1, measurement, attestation: signed('run-certificate', claims, authority.privateKey), receipt: signed('run-receipt', receipt, run.privateKey), fact_canonical: canonical(fact), response_base64: observed.body.toString('base64') }
  };
  } };
}
