# attested-fact-binding

One real Chromium run → one real HTTPS response → one signed fact binding → one independent verifier.

**WARNING: LOCAL REHEARSAL. Software attestation trusts the local supervisor and host; it provides no Popcorn/TEE or ZK guarantee. Inference is explicitly MOCK.** The supervisor performs a real browser capture and signs its observation. An untrusted host can fabricate software attestations. Hardware attestation remains an explicit, failing external boundary.

The fact is GitHub's `archived` boolean for `zkonduit/ezkl`. HTTPS authenticates the public source; this is not a logged-in account proof. Tests and the demo retrieve it live, with no fixture server or canned response. Source failures fail the run.

## Clean-checkout setup and run

Requires Node.js 22+, npm, Git, a Chromium-capable host, and network access to npm, Playwright downloads, and `api.github.com`. Tested on Ubuntu 24.04 in GitHub Actions. No app credentials, payment or running service is needed for this profile.

```sh
git clone https://github.com/sriharshakaramchati/attested-fact-binding.git
cd attested-fact-binding
npm ci
# Linux only, if browser system libraries are missing:
npx playwright install-deps chromium
npm run setup
npm run demo -- --allow-local-software --allow-mock-inference
npm run verify -- --policy artifacts/policy.json --allow-local-software --allow-mock-inference
```

The generator writes public evidence and local state into ignored `artifacts/`. Selecting its generated policy is only a **LOCAL REHEARSAL** trust bootstrap. For third-party verification, select a policy whose authority and workload you independently approved. Verification always requires an explicit `--policy`; it never silently accepts a co-located policy, even if one exists. The flag chooses a file, not whether its contents deserve trust.

The verifier runs in a separate process. Successful software inspection emits a warning to stderr; acceptance is deliberately qualified:

```text
WARNING: LOCAL REHEARSAL: trusts the local supervisor and host; no Popcorn/TEE or ZK guarantee.
PASS LOCAL REHEARSAL (LOCAL_SOFTWARE) binding; inference=MOCK; zk_verified=false; label=active; nonce consumed.
FACT {"field":"repository.archived","schema":"afb.fact/1","source":"https://api.github.com/repos/zkonduit/ezkl","value":false}
```

The label follows the live fact. Verify again with the explicit policy: exit 1, `FAIL: replay: nonce already consumed`. Repeat `demo` to get a new nonce/run. Do not delete nonce markers to reuse old evidence. `npm run verify` fails with `FAIL: policy: explicit trusted --policy path required`. `npm run verify -- --policy artifacts/policy.json` without software opt-in fails with `HARDWARE_ATTESTATION_UNAVAILABLE`; software mode without inference opt-in rejects the MOCK.

Missing files return clean rejections such as `FAIL: policy: file not found`, `FAIL: bundle: file not found`, or `FAIL: challenge: unknown challenge ID`. These messages do not expose raw ENOENT errors or filesystem paths. Replay-state persistence failure also fails closed.

`AFB_OUTPUT_DIR` optionally changes the default bundle/state directory and demo output location; it never selects a policy for verification. `PLAYWRIGHT_BROWSERS_PATH` optionally changes the browser download location; otherwise setup uses ignored `node_modules`. An earlier development sandbox denied Chromium startup; after local process permissions became available, the full local suite also passed with real captures. Clean Linux CI remains the reproducibility check. Python is not required for this Node demo.

## Tests and clean-clone smoke

```sh
npm test
npm run smoke
```

`npm test` is the single command for all positive and negative tests. It captures two live Chromium runs under one software authority. Cases cover fact value/schema/field, cross-run substitution, workload/prover/model identities, source and response changes, nonce tampering/replay, expiration, future-dated challenges, tampered signed/stored validity windows, unknown challenge IDs, malformed canonical JSON, corrupted state, changed MOCK output/instances, and attempts to label software/MOCK evidence as hardware/EZKL. State tests reject internally matching but invalid durations and exercise the exact 30-second skew boundary. CLI tests reject implicit policies and require clean missing-file errors and LOCAL REHEARSAL warnings. A two-process race must accept exactly once. Separate state per mutation prevents replay failures from hiding a different broken check.

`npm run smoke` clones committed HEAD into a fresh temporary directory, runs `npm ci` and `npm run setup`, executes the live demo, requires rejection when `--policy` is omitted, then verifies with an explicitly selected rehearsal policy. It requires the LOCAL REHEARSAL warning, replay rejection and strict hardware-mode rejection. It copies no receipt or signing key. Commit edits before running it; it deliberately tests committed code. Linux system libraries must already be installed. CI runs both commands, without artifact uploads or caches.

[EVIDENCE.md](EVIDENCE.md) records the current hardening run, exact commands and output, followed by clearly labeled historical implementation evidence.

## Trust chain and verification

1. The verifier issues independent random 256-bit nonce/run IDs and records a ten-minute deadline.
2. The trusted supervisor measures capture source files, lockfile, Node/Chromium executables and ONNX identity, creates a fresh in-memory run key, and launches Chromium. Its capture API accepts no caller-provided URL, response, extractor callback or signing payload.
3. An Ed25519 authority signature certifies the run key, workload hash, nonce, run ID, audience and validity. The run key signs a receipt binding that certificate's hash, raw response commitment, canonical fact commitment, input hash, model and prover identities.
4. The verifier checks signatures against a separately trusted policy, checks every binding, independently extracts the fact from the committed response, and compares the nonce/run with issued state.
5. The isolated inference MOCK receives the exact input, model and run identities. Its explicitly tagged result is checked by recomputation; it contains no ZK proof.
6. Only after all checks pass does an atomic exclusive file creation consume the nonce. Then the verifier prints its LOCAL REHEARSAL PASS and verified fact. Successful software inspection also emits the warning and returns it in the `warning` field through `inspectBinding`, `verifyBinding` and `verifyChain`; a warning alone is not acceptance.

Cross-run certificate substitution fails because the receipt key and run hash no longer match. A whole other bundle requires that other run's separately issued challenge. Fact verification trusts the supervisor's captured bytes, never the caller's extraction result.

**Trust bootstrap:** `demo` creates a short-lived authority and writes its public policy separately for a same-host rehearsal. A third party must approve its key and workload hash through an independent trusted channel. Adopting an attacker-supplied `policy.json` destroys the guarantee. The CLI assumes policy/state belong to the relying party. This software profile does not protect against its supervisor or host.

For a submitted bundle, explicitly separate its path from verifier-owned policy/state. `--policy` is always required; `--bundle` and `--state` can independently override the local defaults:

```sh
npm run verify -- --allow-local-software --allow-mock-inference \
  --bundle /path/to/submitted/bundle.json \
  --policy /path/to/verifier/approved-policy.json \
  --state /path/to/verifier/issued-challenges
```

This does not bootstrap remote trust or issue a challenge for you. The approved authority/workload and issued nonce must already be trusted by the relying party. Exported `issue`, `createSupervisor`, and `verifyChain` functions allow that ordering without introducing a service.

## Canonical serialization and attestation contract

The exact canonical fact example is the JSON on the `FACT` line above, excluding `FACT ` and the newline. Keys sort lexicographically; encoding is UTF-8 with no BOM or whitespace; strings use printable ASCII and JSON escaping; numbers are safe integers. Duplicate keys, floats, negative zero, alternate encodings, unknown schema fields and noncanonical ordering are rejected. This narrow format is not general-purpose JCS. Raw source JSON separately uses fatal UTF-8 decoding and duplicate-key rejection.

For domain `D`, a commitment is `SHA256(ASCII("AFB/1/" + D) || 0x00 || bytes)`, lowercase hex. Distinct domains cover fact, response, workload, run, key identity and inference request. Signatures cover domain-prefixed canonical claims with distinct `run-certificate` and `run-receipt` domains. [docs/CONTRACT.md](docs/CONTRACT.md) defines exact public fields, schemas and verification order.

The model input is exactly `{"input_data":[[0]]}` or `{"input_data":[[1]]}`. `input_sha256` is the plain SHA-256 of those bytes, signed in the receipt and recomputed by the verifier. No free-standing digest is mistaken for proof that a model used its preimage. All input/response/fact/output data are public.

## Tiny ONNX model and future inference partner

The checked-in [model](model/classifier.onnx) is 218 bytes: a fixed affine classifier with input `[1,1]`, output `[1,2]`, and scores `[1-x,x]`. It has no training or accuracy claim. Its approved SHA-256 is:

```text
51ba3cdd3e92bfca3287cd57ccff234b925a74509bc8191850975a687f79be45
```

The verifier checks actual ONNX bytes against this pinned identity. Optional regeneration: install `onnx==1.19.0` in a Python environment and run `python model/build_model.py`. The builder checks ONNX validity and evaluates both inputs with ONNX's reference evaluator.

Only [src/inference/mock.mjs](src/inference/mock.mjs) is a MOCK. Its common outer interface is [src/inference/contract.mjs](src/inference/contract.mjs). A future HTTPS partner must accept canonical input plus approved ONNX identity and return an EZKL proof plus public instances. There is no partner URL yet. No actual EZKL settings, VK, SRS, circuit or proof is present. The real verifier always fails closed, including if a MOCK response is relabeled EZKL. [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md) gives exact missing interfaces, environment variables, trust requirements and completion steps.

## Real versus mocked or unavailable

| Component | Status |
| --- | --- |
| Chromium, HTTPS response, raw bytes | Real live capture |
| SHA-256, Ed25519, run certificate/receipt | Real local software cryptography |
| Re-extraction, parsing, identity/binding/replay checks | Real verifier |
| Fixed ONNX artifact and reference evaluation | Real model, no ZK execution proof |
| Future inference partner | **MOCK**, isolated, explicit opt-in |
| Popcorn/Reclaim platform-to-run-key attestation | **Unavailable**, not mocked; strict mode fails |
| EZKL proving/verification at partner boundary | **Unavailable**; no fabricated proof artifacts |

Read [THREAT_MODEL.md](THREAT_MODEL.md) before interpreting PASS. The local binding reference works; the hardware-to-EZKL end-to-end claim remains blocked. No credentials or generated private keys are saved or committed. No paid service, blockchain, database, deployment or existing-repository modification was introduced. `popcorn-handoff` is not a dependency. See [DEMO_SCRIPT.md](DEMO_SCRIPT.md) for a 90-second walkthrough.
