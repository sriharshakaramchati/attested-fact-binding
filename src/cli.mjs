import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { canonical, parseCanonical, requireThat } from './canonical.mjs';
import { issue } from './state.mjs';
import { attestRun } from './supervisor.mjs';
import { inspectBinding } from './verify.mjs';
import { requestFor } from './inference/contract.mjs';
import { proveMOCK } from './inference/mock.mjs';
import { verifyChain } from './chain.mjs';

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const known = ['--allow-local-software', '--allow-mock-inference'];
  requireThat(args.every(x => known.includes(x)), 'unknown flag');
  const directory = resolve(process.env.AFB_OUTPUT_DIR ?? 'artifacts');
  const state = join(directory, 'state');
  if (command === 'demo') {
    requireThat(args.includes('--allow-local-software'), 'explicit --allow-local-software required');
    requireThat(args.includes('--allow-mock-inference'), 'explicit --allow-mock-inference required; real partner unavailable');
    const challenge = await issue(state);
    const { bundle, policy } = await attestRun(challenge);
    await mkdir(directory, { recursive: true });
    const checked = await inspectBinding(bundle, policy, state, { allowLocalSoftware: true });
    const envelope = { binding: bundle, inference: proveMOCK(requestFor(checked)) };
    await writeFile(join(directory, 'bundle.json'), canonical(envelope), { mode: 0o600 });
    await writeFile(join(directory, 'policy.json'), canonical(policy), { mode: 0o600 });
    console.log('GENERATED LOCAL_SOFTWARE: real Chromium HTTPS capture; inference=MOCK; no hardware/ZK attestation.');
  } else if (command === 'verify') {
    const bundle = parseCanonical(await readFile(join(directory, 'bundle.json'), 'utf8'));
    const policy = parseCanonical(await readFile(join(directory, 'policy.json'), 'utf8'));
    const result = await verifyChain(bundle, policy, state, { allowLocalSoftware: args.includes('--allow-local-software'), allowMockInference: args.includes('--allow-mock-inference') });
    console.log(`PASS LOCAL_SOFTWARE binding; inference=MOCK; zk_verified=false; label=${result.label}; nonce consumed.`);
    console.log(`FACT ${canonical(result.fact)}`);
  } else throw new Error('usage: npm run demo|verify -- --allow-local-software --allow-mock-inference');
}
main().catch(error => { console.error(`FAIL: ${error.message}`); process.exitCode = 1; });
