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
  const paths = {};
  const flags = new Set();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (known.includes(arg)) { requireThat(!flags.has(arg), 'duplicate flag'); flags.add(arg); }
    else {
      requireThat(command === 'verify' && ['--bundle', '--policy', '--state'].includes(arg), 'unknown flag');
      requireThat(!paths[arg] && args[i + 1] && !args[i + 1].startsWith('--'), 'missing or duplicate path');
      paths[arg] = resolve(args[++i]);
    }
  }
  requireThat(Object.keys(paths).length === 0 || Object.keys(paths).length === 3, 'provide --bundle, --policy and --state together');
  const directory = resolve(process.env.AFB_OUTPUT_DIR ?? 'artifacts');
  const state = paths['--state'] ?? join(directory, 'state');
  if (command === 'demo') {
    requireThat(flags.has('--allow-local-software'), 'explicit --allow-local-software required');
    requireThat(flags.has('--allow-mock-inference'), 'explicit --allow-mock-inference required; real partner unavailable');
    const challenge = await issue(state);
    const { bundle, policy } = await attestRun(challenge);
    await mkdir(directory, { recursive: true });
    const checked = await inspectBinding(bundle, policy, state, { allowLocalSoftware: true });
    const envelope = { binding: bundle, inference: proveMOCK(requestFor(checked)) };
    await writeFile(join(directory, 'bundle.json'), canonical(envelope), { mode: 0o600 });
    await writeFile(join(directory, 'policy.json'), canonical(policy), { mode: 0o600 });
    console.log('GENERATED LOCAL_SOFTWARE: real Chromium HTTPS capture; inference=MOCK; no hardware/ZK attestation.');
  } else if (command === 'verify') {
    const bundle = parseCanonical(await readFile(paths['--bundle'] ?? join(directory, 'bundle.json'), 'utf8'));
    const policy = parseCanonical(await readFile(paths['--policy'] ?? join(directory, 'policy.json'), 'utf8'));
    const result = await verifyChain(bundle, policy, state, { allowLocalSoftware: flags.has('--allow-local-software'), allowMockInference: flags.has('--allow-mock-inference') });
    console.log(`PASS LOCAL_SOFTWARE binding; inference=MOCK; zk_verified=false; label=${result.label}; nonce consumed.`);
    console.log(`FACT ${canonical(result.fact)}`);
  } else throw new Error('usage: npm run demo|verify -- --allow-local-software --allow-mock-inference');
}
main().catch(error => { console.error(`FAIL: ${error.message}`); process.exitCode = 1; });
