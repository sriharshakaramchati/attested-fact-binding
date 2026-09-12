import { exact, requireThat, hash, sha256, parseCanonical, canonical, hex } from '../canonical.mjs';
import { MODEL_HASH, modelInput } from '../policy.mjs';
export function requestFor(binding) {
  return { version: 1, canonical_input: modelInput(binding.fact), input_sha256: binding.input_sha256, model_sha256: binding.model_sha256, run_sha256: binding.run_sha256, prover_id: binding.prover_id };
}
export function validateRequest(request) {
  exact(request, ['version', 'canonical_input', 'input_sha256', 'model_sha256', 'run_sha256', 'prover_id'], 'inference request');
  requireThat(request.version === 1 && request.model_sha256 === MODEL_HASH && hex(request.run_sha256) && hex(request.prover_id), 'inference: wrong model, run or prover identity');
  const parsed = parseCanonical(request.canonical_input);
  requireThat(['{"input_data":[[0]]}', '{"input_data":[[1]]}'].includes(canonical(parsed)), 'inference: invalid input');
  requireThat(sha256(request.canonical_input) === request.input_sha256, 'inference: input hash mismatch');
  return parsed.input_data[0][0];
}
export const requestHash = request => hash('inference-request', request);
export function validateResponse(request, response) {
  validateRequest(request);
  exact(response, ['version', 'kind', 'request_sha256', 'model_sha256', 'input_sha256', 'run_sha256', 'prover_id', 'settings_sha256', 'vk_sha256', 'proof', 'public_instances', 'scores', 'label'], 'inference response');
  requireThat(response.version === 1 && ['MOCK', 'EZKL'].includes(response.kind), 'inference: unsupported kind');
  requireThat(response.request_sha256 === requestHash(request), 'inference: request binding mismatch');
  for (const k of ['model_sha256', 'input_sha256', 'run_sha256', 'prover_id']) requireThat(response[k] === request[k], `inference: ${k} mismatch`);
}
