// Unavailable real integration, NOT a mock. Never treat transport or schema
// validation as an EZKL proof check. No fabricated proof, settings, VK or SRS.
import { validateResponse } from './contract.mjs';
export function verifyEZKL(request, response) {
  validateResponse(request, response);
  throw new Error('EZKL_VERIFIER_UNAVAILABLE: require pinned settings, VK/SRS, actual instance layout and EZKL verification; see docs/DEPENDENCIES.md');
}
