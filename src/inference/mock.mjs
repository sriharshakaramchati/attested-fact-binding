// MOCK — the only mock boundary in this repository. This produces NO ZK proof.
// The outer request/response contract is shared with the future real partner.
import { canonical, requireThat } from '../canonical.mjs';
import { validateRequest, validateResponse, requestHash } from './contract.mjs';
export function proveMOCK(request) {
  const x = validateRequest(request);
  return { version: 1, kind: 'MOCK', request_sha256: requestHash(request), model_sha256: request.model_sha256, input_sha256: request.input_sha256, run_sha256: request.run_sha256, prover_id: request.prover_id, settings_sha256: null, vk_sha256: null, proof: null, public_instances: [[String(x), String(1-x), String(x)]], scores: [1-x, x], label: x ? 'archived' : 'active' };
}
export function verifyMOCK(request, response) {
  validateResponse(request, response);
  requireThat(response.kind === 'MOCK', 'MOCK: expected MOCK response');
  requireThat(canonical(response) === canonical(proveMOCK(request)), 'MOCK: output/public-instance mismatch');
  return { inference: 'MOCK', zk_verified: false, label: response.label };
}
