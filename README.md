# attested-fact-binding

Milestone 1: standalone repository and explicit attestation contract.

This repository is being implemented. No passing example is claimed at this milestone.

The local profile will run real Chromium against a real HTTPS source and issue a real Ed25519 software attestation under a locally trusted supervisor. The verifier independently extracts the fact from the signed response bytes, so the extractor is untrusted. The local supervisor and host remain trusted; this is **not Popcorn, Reclaim, or hardware attestation**.

A Popcorn/TEE profile requires a platform-verified binding from an approved workload to its run signing key. The published browser-runtime receipt alone does not provide that binding. This unavailable boundary must fail closed, never accept a fabricated platform token.

The only MOCK will be a separate future inference-partner module. It returns explicitly MOCK-tagged results and cannot pass real EZKL verification.

No existing repository is modified. No paid service, blockchain, database, or frontend is introduced.
