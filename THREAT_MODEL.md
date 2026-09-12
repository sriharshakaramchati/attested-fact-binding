# Threat model

**WARNING: LOCAL REHEARSAL. Accepted software evidence trusts the supervisor and host; no Popcorn/TEE or ZK guarantee is established.** The CLI requires explicit `--policy` selection, and successful software inspection emits this warning and carries it in API results. Neither a flag nor a co-located file independently establishes that a policy is trustworthy.

## Established by LOCAL_SOFTWARE verification

Given a relying party's approved authority key, workload hash, ONNX identity, intact issued-challenge state and clock, acceptance establishes that:

- The authority signed a run certificate for this public key, workload, nonce, run ID, audience and validity window.
- That run key signed a receipt for this certificate hash, source response commitment, canonical fact/input commitments, source metadata, prover and model identity.
- The supplied response bytes match their commitment. Independent fixed extraction yields exactly the canonical fact; no caller-supplied extraction is trusted.
- The nonce/run was issued by the verifier and is fresh. Atomic consumption prevents another acceptance with the same state, including concurrent processes.

These are real signature, commitment, parsing and local state guarantees. The connection from signed observations to actual browser execution depends on the software supervisor and host.

## Trusted components

The supervisor process, Node/Playwright and dependencies, OS/process isolation, filesystem, RNG, and authority/run keys in memory are trusted. The capture API has no arbitrary-message signing endpoint or caller-provided response. The untrusted extractor is the party presenting a fact, not the capture authority.

Chromium, TLS, local CA policy and GitHub's response are trusted. The receipt commits to Chromium's decoded response body, not a self-verifying TLS transcript. A remote verifier checks the supervisor's signed HTTPS observation; it does not independently validate the TLS transcript.

The verifier's code, source policy, independently approved authority key/workload, pinned model hash, clock and state must be protected. An attacker-supplied policy cannot establish trust. The local generator writes a policy only for same-host LOCAL REHEARSAL; the verifier never automatically selects it. A third party must explicitly select its own independently approved policy.

SHA-256 collision resistance and Ed25519 unforgeability are assumed. The measurement covers source files, lockfile, ONNX identity, Node executable/version and Chromium executable. It is not hardware measurement or a full container/memory digest. Shared libraries/frameworks, browser resources, installed dependencies beyond lockfile integrity, kernel, environment and CA store remain host assumptions. There is no defense against replacement between measurement and use, injected libraries, host memory access, compromised browser or dishonest authority.

## Adversary and substitutions

An attacker may alter any public field, response, canonical text, digest, key, output or inference response; mix authentic components from distinct runs; replay evidence; submit malformed JSON; race verification; and create arbitrary keys. They may not change relying-party trust roots, approved code, clock or state.

Changed facts fail re-extraction or signed commitments even if an attacker updates untrusted hashes. Source/prover/model changes invalidate signatures or fail policy. Run B's valid certificate cannot authenticate run A's receipt; tests use two real captures signed under the same authority. Substituting all of run B requires B's separately issued nonce; it does not turn B into A.

Canonical encodings are strictly checked. Source JSON rejects duplicate fields, including escaped duplicate names. UTF-8 decoding is fatal; canonical protocol strings are printable ASCII; input domain is exactly zero or one. No hidden extraction relation is claimed: the response is public.

## Replay and failure

Nonce and run ID are independent 256-bit random values. Both must match verifier-issued state. Validity is exactly 600 seconds; verifier clock may be at most 30 seconds behind issue time. Receipt time must lie within the issued interval and at most 30 seconds ahead of verification. Tests reject 31-second future challenges, altered signed/stored windows, and matching but invalid window lengths. Time checks supplement, never replace, the challenge. Unknown challenge IDs return a clean rejection without OS error strings or filesystem paths.

After all binding/inference checks, the verifier exclusively creates `<nonce>.used`, flushes it and the directory, then prints PASS. A concurrent loser fails. Crashes may burn a challenge without printing PASS. Validation failure does not consume a good challenge. Unknown or corrupt state fails.

This assumes a local POSIX filesystem with reliable exclusive creation. State deletion, rollback, restoring snapshots, hostile writes and independent verifier copies defeat replay defense and are outside scope. No distributed state or cleanup system is implemented. Repeating the demo requires a fresh live request, not reusing an expired receipt.

## Not established

- No Popcorn/Reclaim, GCP platform, secure boot, TEE or image-signature proof is verified. Hardware mode throws. Local evidence is not hardware evidence.
- No origin guarantee is available to a third party that also distrusts the supervisor/host. Software signatures alone cannot provide one.
- The only MOCK is inference. Its output is recomputed, not ZK verified; `zk_verified=false`. The real EZKL verifier throws. Settings/VK/SRS/circuit/proof are absent, not invented.
- No privacy: response, fact, input, output and public run metadata are disclosed. No logged-in account ownership or authorization is proven.
- GitHub may be compromised, mistaken, cached or change later. This establishes a trusted supervisor's observation, not eternal or physical-world truth.
- No training provenance, predictive usefulness, production security audit, universal AI correctness, availability, payment, or isolation from a malicious host is proven.

## Hardware gap confirmed in source

At Popcorn commit `d378e38c52ee7c4c21b5520280a54b157a83dcef`, `services/attestor/main.go` sends the caller nonce and a workload/verifier image digest binding to the platform token API. The response has no content-signing run public key. Putting a fact/key hash into that caller nonce does not prove that the approved workload generated the key or observed the fact: any caller can choose such a nonce.

A real provider must generate/custody the run key within an approved capture workload, attest that origin/key/workload/run/challenge relation, and sign only its captured response. A real verifier must validate platform roots, token signature/audience/time, approved workload identities and the internal key-origin binding. The [missing contract](docs/DEPENDENCIES.md) is explicit. A metadata receipt plus an outside wrapper signature is not an acceptable replacement.
