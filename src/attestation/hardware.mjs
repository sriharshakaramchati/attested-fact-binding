// This unavailable boundary is NOT a mock and never returns verified evidence.
export function requireHardwareAttestation() {
  throw new Error('HARDWARE_ATTESTATION_UNAVAILABLE: require a platform-verified run signing key bound to the approved Popcorn workload, nonce and run; see docs/DEPENDENCIES.md');
}
