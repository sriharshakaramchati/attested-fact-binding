import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { canonical, parseCanonical, requireThat } from './canonical.mjs';
import { issue } from './state.mjs';
import { attestRun } from './supervisor.mjs';
import { verifyBinding } from './verify.mjs';

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const known = ['--allow-local-software'];
  requireThat(args.every(x => known.includes(x)), 'unknown flag');
  const directory = resolve(process.env.AFB_OUTPUT_DIR ?? 'artifacts');
  const state = join(directory, 'state');
  if (command === 'demo') {
    requireThat(args.includes('--allow-local-software'), 'explicit --allow-local-software required');
    const challenge = await issue(state);
    const { bundle, policy } = await attestRun(challenge);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'bundle.json'), canonical(bundle), { mode: 0o600 });
    await writeFile(join(directory, 'policy.json'), canonical(policy), { mode: 0o600 });
    console.log('GENERATED LOCAL_SOFTWARE: real Chromium HTTPS capture; no hardware attestation.');
  } else if (command === 'verify') {
    const bundle = parseCanonical(await readFile(join(directory, 'bundle.json'), 'utf8'));
    const policy = parseCanonical(await readFile(join(directory, 'policy.json'), 'utf8'));
    const result = await verifyBinding(bundle, policy, state, { allowLocalSoftware: args.includes('--allow-local-software') });
    console.log(`PASS LOCAL_SOFTWARE binding: ${canonical(result.fact)}; nonce consumed; no hardware guarantee.`);
  } else throw new Error('usage: npm run demo|verify -- --allow-local-software');
}
main().catch(error => { console.error(`FAIL: ${error.message}`); process.exitCode = 1; });
