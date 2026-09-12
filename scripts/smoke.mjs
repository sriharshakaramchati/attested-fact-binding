import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Clean clone of committed HEAD; no fixtures, keys, node_modules, or run state
// are copied. Executes exactly the documented setup/demo/verify commands.
const temp = mkdtempSync(join(tmpdir(), 'afb-clean-'));
const checkout = join(temp, 'checkout');
function run(command, args, cwd, expected = 0, pattern) {
  console.log(`SMOKE $ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: { ...process.env, AFB_OUTPUT_DIR: join(checkout, 'artifacts') }, maxBuffer: 8 * 1024 * 1024 });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== expected) throw new Error(`expected exit ${expected}, got ${result.status}`);
  if (pattern && !pattern.test(result.stdout + result.stderr)) throw new Error(`missing expected output ${pattern}`);
}
try {
  run('git', ['clone', '--no-local', '--quiet', process.cwd(), checkout], process.cwd());
  run('npm', ['ci'], checkout);
  run('npm', ['run', 'setup'], checkout);
  const flags = ['--', '--allow-local-software', '--allow-mock-inference'];
  run('npm', ['run', 'demo', ...flags], checkout, 0, /GENERATED LOCAL_SOFTWARE/);
  run('npm', ['run', 'verify', ...flags], checkout, 0, /PASS LOCAL_SOFTWARE binding; inference=MOCK; zk_verified=false/);
  run('npm', ['run', 'verify', ...flags], checkout, 1, /replay: nonce already consumed/);
  run('npm', ['run', 'verify'], checkout, 1, /HARDWARE_ATTESTATION_UNAVAILABLE/);
  console.log('SMOKE PASS: clean clone; real HTTPS browser capture; software binding accepted; inference MOCK; replay and hardware-only mode rejected.');
} catch (error) { console.error(`SMOKE FAIL: ${error.message}`); process.exitCode = 1; }
finally { rmSync(temp, { recursive: true, force: true }); }
