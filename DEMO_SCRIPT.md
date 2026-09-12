# 90-second demo

Preinstall with `npm ci`, Linux browser libraries if needed, and `npm run setup`. Use a Chromium-capable host; identify prior CI logs as prior evidence if live capture fails.

**0–15 seconds:** “We bind one observed fact to one browser run. Chromium retrieves whether the EZKL GitHub repository is archived. A local supervisor signs what it observed. This is software attestation: the supervisor and host are trusted. It is not a Popcorn hardware proof.”

**15–35 seconds:**

```sh
npm run demo -- --allow-local-software --allow-mock-inference
npm run verify -- --allow-local-software --allow-mock-inference
```

“A separate verifier checks the run certificate and receipt, then extracts the fact again from the signed response. It checks input hash, model identity and fresh nonce. The caller's extractor is not trusted.”

**35–50 seconds:** “The result explicitly says LOCAL_SOFTWARE, inference MOCK, and zk_verified=false. The tiny ONNX artifact is real. The future inference partner is the only mock; it returns no fake EZKL proof.”

**50–65 seconds:**

```sh
npm run verify -- --allow-local-software --allow-mock-inference
```

“Reusing this nonce now fails. A timestamp alone would not prevent that.”

**65–80 seconds:**

```sh
npm test
```

“Two live browser runs let us reject changed facts, schemas, models, workloads and cross-run substitution. Simultaneous verifiers accept one nonce only once.”

**80–90 seconds:** “Hardware completion needs an attested run signing key generated inside the capture workload. Inference completion needs actual EZKL proof generation and verification with approved settings and keys. Strict mode rejects those missing links today.”

Network timing varies. Dependencies must be installed before presenting. Never describe the local software authority or the inference MOCK as real TEE/EZKL evidence.
