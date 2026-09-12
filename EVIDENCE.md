# Execution evidence

Repository: https://github.com/sriharshakaramchati/attested-fact-binding

Status: implemented and published **LOCAL_SOFTWARE browser/fact binding** with the requested isolated inference **MOCK**. The Popcorn/TEE-to-EZKL guarantee is **not complete**. Its actual missing interfaces are listed in [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md). No statement below upgrades software evidence to hardware evidence.

**WARNING: LOCAL REHEARSAL. Software evidence trusts the local supervisor and host; no Popcorn/TEE or ZK guarantee is established.** Current verification requires an explicitly selected trusted `--policy`. Historical outputs below predate this hardening and are preserved as historical evidence, not current command instructions.

## Hardening validation — 2026-09-12

Implementation commits:

- `6cdc46e` — require an explicit trusted policy, emit/carry LOCAL REHEARSAL warnings, and replace raw file/state errors with clean rejection messages.
- `a809078` — future-dated challenge, tampered-window and unknown-ID coverage; smoke checks both the warning and explicit-policy requirement.

[Clean Linux CI run 34688659103](https://github.com/sriharshakaramchati/attested-fact-binding/actions/runs/34688659103) tested `a80907868c8c4b07982ecdc751c35920a39a5469` on Ubuntu 24.04 / Node 22. The full suite and clean-clone smoke both passed. The same full suite also passed locally on Node 24.20.0 with two real Chromium HTTPS captures after process permissions became available; no browser or attestation replacement was used.

Exact CI commands:

```sh
npm ci
npx playwright install-deps chromium
npm run setup
npm test
npm run smoke
```

The smoke suite cloned committed HEAD into an empty temporary checkout, then ran:

```sh
npm ci
npm run setup
npm run demo -- --allow-local-software --allow-mock-inference
npm run verify -- --allow-local-software --allow-mock-inference
npm run verify -- --allow-local-software --allow-mock-inference --policy artifacts/policy.json
npm run verify -- --allow-local-software --allow-mock-inference --policy artifacts/policy.json
npm run verify -- --policy artifacts/policy.json
```

The first verifier call must fail for missing `--policy`, even though a valid generated policy is co-located. The next call must accept with the explicitly selected **LOCAL REHEARSAL** policy; the following calls must reject replay and hardware-only mode. A third party must select its independently approved policy instead of trusting the generator's file. Adding a flag does not establish policy trust.

Actual Linux suite output:

```text
# tests 66
# pass 66
# fail 0
# skipped 0
# duration_ms 7211.900588
```

Actual rejection/acceptance excerpts:

```text
REJECT future-dated challenge: challenge: issued in future
REJECT stored validity window: challenge: expires_at mismatch
REJECT implicit policy: explicit trusted --policy path required
REJECT unknown challenge ID: clean verifier error
WARNING: LOCAL REHEARSAL: trusts the local supervisor and host; no Popcorn/TEE or ZK guarantee.
FAIL: policy: explicit trusted --policy path required
PASS LOCAL REHEARSAL (LOCAL_SOFTWARE) binding; inference=MOCK; zk_verified=false; label=active; nonce consumed.
FAIL: replay: nonce already consumed
SMOKE PASS: clean clone; explicit policy; LOCAL REHEARSAL binding; inference MOCK; implicit policy, replay and hardware-only mode rejected.
```

State coverage includes the exact allowed 30-second future skew; rejection at 31 seconds; rejection one second after expiry; invalid durations of -1, 0, 599, 601 and 1200 seconds even when claims and stored state match; and missing/non-directory state paths. Integration coverage rejects modified signed and stored windows. API and CLI tests require the exact clean `challenge: unknown challenge ID` message. CLI tests also require clean missing-policy/bundle messages, preserve the nonce after missing-policy rejection, and confirm warnings on successful direct and combined verification. Existing cross-run, identity, mutation and race tests remain enabled.

No EZKL integration work was started. No changes were made to the model, inference modules, `popcorn-oss` or `popcorn-handoff`. README, threat/contract documentation and the demo commands were updated to require explicit policy selection and identify LOCAL REHEARSAL acceptance. All implementation work is confined to this repository.

## Historical initial implementation — before hardening

The sections below retain the original run records and output. Their old verifier commands are **not the current interface**; use the explicit-policy commands above or in README.

### Verified runs

| Commit | Run | Actual result |
| --- | --- | --- |
| `7f136d00abe1d002f090a5ba28c46c2d8ad02664` | [34686633446](https://github.com/sriharshakaramchati/attested-fact-binding/actions/runs/34686633446) | Real Chromium capture and separate binding-only verification passed; no inference mock involved in this first milestone |
| `14d3940dbf32463623a32234f07d1cc8416cc240` | [34686808718](https://github.com/sriharshakaramchati/attested-fact-binding/actions/runs/34686808718) | 47 tests passed, no failures/skips; clean-clone smoke passed |
| `8cc6c43a6e9eeccb641baac4cdce9cad6455792c` | [34687155811](https://github.com/sriharshakaramchati/attested-fact-binding/actions/runs/34687155811) | 48 tests passed, no failures/skips; includes separate policy/state CLI test; clean-clone smoke passed |

All above ran on a fresh Ubuntu 24.04 standard GitHub-hosted runner, Node 22. The repository is public. No paid/larger runners, deployment, packages, artifact upload or action cache is configured. The last row is the fully tested implementation commit; subsequent documentation changes do not alter the implementation.

### Historical validation commands

CI executed:

```sh
npm ci
npx playwright install-deps chromium
npm run setup
npm test
npm run smoke
```

The smoke script executed `git clone --no-local --quiet <committed-checkout> <new-temporary-checkout>`, then in that entirely new checkout:

```sh
npm ci
npm run setup
npm run demo -- --allow-local-software --allow-mock-inference
npm run verify -- --allow-local-software --allow-mock-inference
npm run verify -- --allow-local-software --allow-mock-inference
npm run verify
```

The two final commands were required to return exit 1 for replay and unavailable hardware respectively. Their rejection is smoke-test success, not a hidden failing positive case.

Local additional checks:

```sh
node --test test/canonical.test.mjs
node --check src/verify.mjs
node --check src/canonical.mjs
git diff --check
```

All JavaScript modules were also checked individually with `node --check`. The model builder was run twice with Python 3.9.6 and `onnx==1.19.0`; both runs returned identical bytes/hash and passed ONNX's reference evaluation for both valid inputs. The actual environment-specific invocation was `../../work/model-env/bin/python model/build_model.py`; a normal development environment uses `python model/build_model.py` after installing that ONNX version.

Repository creation/publication used:

```sh
gh repo create sriharshakaramchati/attested-fact-binding --public --description 'Minimal browser-run to fact binding verifier; explicit local software trust and unavailable hardware boundary' --source . --remote origin
git push -u origin main
git push
```

Small milestone commits were made before pushes. No command targeted `popcorn-handoff` for writes.

### Historical test output excerpts

From run 34687155811 (2026-09-12; transport log timestamps omitted):

```text
# tests 48
# pass 48
# fail 0
# skipped 0
# duration_ms 2823.503779
```

The suite uses two live Chromium captures; it has no source or attestation stub. The only mock is explicitly labeled inference MOCK. Positive assertions include software signature/binding verification and a binding-only path with no mock dependency. Negative assertions exercise:

- Changed fact value, schema and field name.
- Run-A receipt attached to valid run-B certificate, both signed by the same real local authority.
- Workload policy/measurement mismatch; untrusted authority; modified prover/model identity; changed actual ONNX bytes.
- Changed source metadata, response bytes, nonce, fact commitment and malformed canonical serialization.
- Duplicate nonce, expired envelope with advanced verifier clock, missing/corrupted state, and two competing verifier processes.
- MOCK without opt-in, altered MOCK output/public input/prover/run, and MOCK relabeled EZKL.
- Local software evidence presented to hardware-only mode.

Additional positive checks establish that failed verification does not consume a good challenge and a submitted bundle is checked against separately supplied trusted policy/state.

Actual rejection examples (from the 47-test run, retained in the 48-test implementation):

```text
REJECT fact value: fact: differs from signed source response
REJECT fact schema: fact: schema or source mismatch
REJECT fact field name: fact: schema or source mismatch
REJECT cross-run substitution: run-receipt: invalid signature
REJECT workload mismatch: workload: hash mismatch
REJECT wrong prover: run-receipt: invalid signature
REJECT wrong model: model: unapproved identity
REJECT replay: nonce already consumed
REJECT expired envelope: challenge: expired or future
REJECT malformed canonical fact: canonical: noncanonical serialization
PASS concurrent replay: exactly one PASS and one FAIL
```

### Historical clean-clone smoke output

```text
GENERATED LOCAL_SOFTWARE: real Chromium HTTPS capture; inference=MOCK; no hardware/ZK attestation.
PASS LOCAL_SOFTWARE binding; inference=MOCK; zk_verified=false; label=active; nonce consumed.
FACT {"field":"repository.archived","schema":"afb.fact/1","source":"https://api.github.com/repos/zkonduit/ezkl","value":false}
FAIL: replay: nonce already consumed
FAIL: HARDWARE_ATTESTATION_UNAVAILABLE: require a platform-verified run signing key bound to the approved Popcorn workload, nonce and run; see docs/DEPENDENCIES.md
SMOKE PASS: clean clone; real HTTPS browser capture; software binding accepted; inference MOCK; replay and hardware-only mode rejected.
```

Actual model build output:

```text
ONNX PASS: both binary inputs; 218 bytes; sha256=51ba3cdd3e92bfca3287cd57ccff234b925a74509bc8191850975a687f79be45
```

### Historical local failures

The first npm install tried an unwritable default cache and failed. Installation succeeded with a workspace-owned npm cache; no system cache permissions were modified. GitHub authentication initially failed while network was restricted; after network permission it authenticated the actual `sriharshakaramchati` account, created this repository and pushed successfully.

Both local macOS Chromium variants aborted in the execution sandbox; the headless variant reported `bootstrap_check_in ... Permission denied (1100)`. The local positive browser path is not reported as passing. The genuine live evidence comes from the fresh Linux CI checkout. No macOS workaround or substituted network response was used.

### Historical reference-repository and secret checks

Before/after snapshots of `popcorn-handoff` hashed all **14,056** files, including `.git`, source and installed dependencies, and compared symlink targets. Contents and symlink targets were identical. Aggregate snapshot SHA-256:

```text
a4868b1b6cdd0ddc8082aa5a0dd3c2a932e8c11c5a0da0c188b5f2532d1b5bd8
```

The snapshot is stored outside this repository during execution. No reference-repository file was written. A heuristic secret scan of working files and all four implementation commits found no private-key blocks or supported GitHub/OpenAI token patterns. The code generates real authority/run keys in memory and never exports private keys. Generated public evidence/state and installed dependencies are ignored. This is a documented scan, not a claim that a heuristic scanner proves the absence of every possible secret.

### Historical acceptance scope

Repository creation/publication, working local software path, all required mutation tests, clean clone, meaningful commits, documentation, independent policy/state separation and reference preservation are established above. The condition that a real Popcorn/TEE workload attests the run key remains externally blocked. EZKL proof generation/verification remains the explicitly requested MOCK partner boundary. Those are not passing real integration tests, and no overall hardware/ZK completion is claimed.
