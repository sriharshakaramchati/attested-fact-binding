# Implementation decisions

Repository: `sriharshakaramchati/attested-fact-binding` (new standalone repository).
First milestone: establish the scope and attestation contract, then implement the narrow executable flow.

The previous audit is input. The browser session adapter in `popcorn-handoff` is reference-only and remains untouched. Upstream [Popcorn attestation](https://github.com/reclaimprotocol/popcorn-oss/blob/main/docs/attestation.md) establishes workload/platform evidence but does not expose the needed content-signing key binding.

Implement a real local software supervisor, not an emulation of a TEE. It measures the capture sources, lockfile, Node version and Chromium executable, launches Chromium, captures one actual HTTPS response, and certifies a fresh run key. That key signs the response commitment, fact commitment, input hash, model identity, run hash, challenge and timestamps. Public verification trusts the supervisor key through a separate policy file, never through the bundle.

This is a limited software-attestation profile: an untrusted host can forge observations. Remote hardware attestation remains unavailable and must reject. Do not claim the original real Popcorn-to-EZKL acceptance criterion is satisfied by this profile.

Fact: GitHub's `archived` boolean for `zkonduit/ezkl`; stable schema, public HTTPS source, no account or payment. The verifier checks the raw response, resource identity and boolean independently. No source fixture or recorded-response substitution is allowed. Tests use live Chromium captures.

Canonical fact: strict ASCII-keyed JSON, keys lexicographically sorted, UTF-8, integers only, no whitespace/BOM/newline; schema includes version, field, boolean value, source URL. Reject duplicate keys and noncanonical encodings. Domain-separate SHA-256 for facts, responses, workloads, run descriptors, key identities, and signed messages. Canonical model input is exactly `{"input_data":[[0]]}` or `{"input_data":[[1]]}`; its plain SHA-256 is separately bound by the signed receipt.

The inference interface accepts canonical input, model hash, and request/run binding. An isolated MOCK computes `[1-x,x]` and emits `kind: MOCK`; no proof bytes are invented. A real response must contain an EZKL proof plus public instances and pinned model/settings/VK identities. Real EZKL verification is unavailable until that adapter exists; no MOCK-to-real fallback.

Public: raw response, fact, input, output, run identity, workload measurement, public keys, nonce, timestamps. Private: process-memory signing keys only; neither saved nor committed. No data-privacy guarantee.

Replay defense: verifier-issued nonce and expected run ID in a local file, expiration, atomic exclusive claim of the nonce during acceptance. Timestamp alone is never sufficient. Replay state integrity and verifier clock are trusted.

Milestones / three-day sequence:
1. Day 1: canonical formats, real capture, signed run certificate and receipt, independent verification; commit the working chain.
2. Day 2: isolated inference MOCK; positive and adversarial live integration suite; atomic replay tests; commit tests and hardening.
3. Day 3: clean clone smoke, precise contracts/threat model/demo documentation, evidence, publication; commit validated docs.

Planned files: `src/{canonical,crypto,policy,capture,supervisor,verify,state,cli}.mjs`, `src/inference/{contract,mock,real}.mjs`, `src/attestation/hardware.mjs`, `test/*.test.mjs`, `scripts/smoke.mjs`, `docs/{CONTRACT,DEPENDENCIES}.md`, `THREAT_MODEL.md`, `DEMO_SCRIPT.md`, `README.md`, lockfile. No broad SDK or production infrastructure.

Commands: `npm ci`, `npm run setup`, `npm run demo`, `npm run verify -- --allow-local-software --allow-mock-inference`, `npm test`, `npm run smoke`. Final exact flags and outputs will be verified before publication.
