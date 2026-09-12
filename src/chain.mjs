import { exact, requireThat } from './canonical.mjs';
import { inspectBinding } from './verify.mjs';
import { requestFor } from './inference/contract.mjs';
import { verifyMOCK } from './inference/mock.mjs';
import { verifyEZKL } from './inference/real.mjs';
import { consume } from './state.mjs';
export async function verifyChain(envelope, policy, state, options = {}) {
  exact(envelope, ['binding', 'inference'], 'chain');
  const result = await inspectBinding(envelope.binding, policy, state, options);
  const request = requestFor(result);
  let inference;
  if (envelope.inference.kind === 'MOCK') {
    requireThat(options.allowMockInference === true, 'MOCK inference rejected: explicit opt-in required');
    inference = verifyMOCK(request, envelope.inference);
  } else inference = verifyEZKL(request, envelope.inference);
  await consume(state, envelope.binding.attestation.claims.nonce);
  return { ...result, ...inference };
}
