# Explicit external boundaries

No real external proof was fabricated. The only MOCK is `src/inference/mock.mjs`. Environment variables listed as reserved below are a proposed integration contract; setting them does not enable unimplemented verification.

## BLOCKED: Popcorn/Reclaim workload-to-run-key evidence

**Missing:** an existing provider interface that attests a content-signing key generated/custodied inside the approved capture workload, binds that key to one browser run and verifier challenge, and returns a receipt over the actual observed response. Also missing: a supported native platform verifier, independently approved trust roots/workload image policy and any provider access credentials. The current upstream runtime receipt alone is insufficient.

Inspected upstream source: [services/attestor/main.go at d378e38](https://github.com/reclaimprotocol/popcorn-oss/blob/d378e38c52ee7c4c21b5520280a54b157a83dcef/services/attestor/main.go). Its native request is `GET /proof/<session>?nonce=<value>`. Its response fields are `proof_version`, `tee_provider`, `tee_technology`, `nonce`, `timestamp`, `workload {container_name,image_digest}`, `verifier {container_name,image_digest}`, `attestation {token}` and optional error. `generateTEEProof` puts the supplied nonce and `runtimeDigestBinding` into the platform token. There is no run content-signing public key in the response.

**Required future capture request (proposed, not an existing Popcorn endpoint):**

```text
POST $AFB_ATTESTATION_URL
Authorization: Bearer <AFB_ATTESTATION_TOKEN>  // only if provider requires it
{
  version: 1,
  challenge: {version:1, nonce, run_id, issued_at, expires_at},
  source: "https://api.github.com/repos/zkonduit/ezkl",
  approved_workload_sha256,
  model_sha256
}
```

The request must **not** accept a client-supplied response body, fact or signing public key as evidence of capture. The workload generates its key internally and owns the capture/signing operation.

**Required future response (proposed):**

```text
{
  version: 1,
  platform_evidence: <complete native signed platform evidence>,
  run_descriptor: {
    profile: <approved native profile>, nonce, run_id, issued_at, expires_at,
    audience, workload_sha256, run_public_key
  },
  key_origin_binding: <platform/workload-verifiable evidence linking that
                       internally generated key to that exact descriptor>,
  receipt: <run-key signature over the CONTRACT.md receipt claims>,
  response_base64: <actual observed response bytes>,
  fact_canonical: <strict derived fact bytes>
}
```

The native evidence's actual encoding and verifier cannot be chosen without a real provider contract. `key_origin_binding` is a required cryptographic relationship, not permission to supply an unchecked JSON assertion. There is intentionally no parser that accepts this shape as sufficient evidence.

**Verification assumptions:** independently pinned platform issuer/roots, audience, hardware and workload-image policy; token signature and time verification; secure in-workload key generation/custody; authentic response capture; replay state. An echoed caller nonce containing a key/fact hash is insufficient. Attested image identity alone does not prove observed data provenance.

**Reserved environment variables:** `AFB_ATTESTATION_URL`, `AFB_ATTESTATION_TOKEN` (if required), `AFB_HARDWARE_POLICY_FILE` (independently approved roots/images/audience). If Reclaim's managed SDK supplies this contract, its operator must also provide `RECLAIM_APP_ID`, `RECLAIM_APP_SECRET`, `RECLAIM_PROVIDER_ID` and a pinned provider version through environment/configuration; no values are currently available or used. Do not paste secrets into issues or commit them.

**Step becoming real:** replace the throwing `src/attestation/hardware.mjs` boundary with the provider's verified native evidence-to-run-key adapter, run a live challenge, and verify the same response/fact binding under hardware policy. Merely supplying credentials does not implement the missing key-binding protocol. The local software supervisor remains a separately named profile; it must never become a fallback for failed hardware verification.

## BLOCKED / MOCK: future inference partner and EZKL verification

**Missing:** a partner URL/contract implementation, pinned EZKL version, approved model-to-circuit/settings/VK/SRS manifest, actual proof, and actual public-instance layout. The repository includes real ONNX bytes but intentionally uses only the requested inference MOCK. A real prover could eventually run locally; a remote service is not inherently necessary.

**Expected request/response:** exact `InferenceRequest` and `InferenceResponse` in [CONTRACT.md](CONTRACT.md). The future service receives `canonical_input` unchanged and the approved ONNX hash. It returns `kind="EZKL"`, genuine proof JSON/public instances, model/settings/VK hashes and scores. Its URL will be supplied by the future partner; no endpoint is invented.

**Verification assumptions:** EZKL cryptographic soundness and setup assumptions, approved SRS provenance, reliable ONNX compilation, fixed model parameters, pinned settings/verification key and instance mapping. The verifier hashes decoded actual public model input and compares it with the signed input hash, then compares actual public output with displayed scores. It must not trust response metadata as proof. SHA-256 need not be implemented inside the model circuit when the actual model input is public and compared by the combined verifier.

**Reserved environment variables:** `AFB_INFERENCE_URL`, `AFB_INFERENCE_TOKEN` only if partner authentication is required, `AFB_EZKL_MANIFEST` for a relying-party-approved local manifest. These are not consumed by the current throwing real adapter. Never send source credentials or authority/run private keys to inference.

**Step becoming real:** implement the HTTP transport or local EZKL prover and `src/inference/real.mjs`, generate/pin model settings/circuit/VK/SRS, inspect actual native field encodings, generate a real proof, call real `ezkl.verify`, and pass positive plus tampered-input/output/key tests. Keep the MOCK's null proof and tagged output rejected in real mode. No settings, VK, SRS or proof hash is currently asserted.

Primary references: [EZKL](https://github.com/zkonduit/ezkl), [EZKL docs](https://docs.ezkl.xyz/), and [Python interface at e196b111](https://github.com/zkonduit/ezkl/blob/e196b111c1bafaa61b92ae431cd3c3fe9371da05/ezkl.pyi). These were inspected; no EZKL call was claimed to have run.

## LOCAL ENVIRONMENT: restricted macOS browser startup

**Observed failure:** Chromium headless startup in the development sandbox terminated at `bootstrap_check_in ... Permission denied (1100)`. Full Chromium also aborted during macOS application registration. No browser/source replacement was introduced. No credential can fix this OS process-permission boundary.

**Request/response:** no external protocol is involved; `chromium.launch` must return a real running browser. **Environment variables:** none required to fix it. `PLAYWRIGHT_BROWSERS_PATH` changes installation location only. **Resolution:** use a normal permitted desktop terminal or the documented Linux environment. The entire live suite and clean-clone smoke were executed successfully on GitHub's standard public-repository Ubuntu runner.

## Availability, no paid dependency

The public source may rate-limit or change; the demo fails loudly and never silently uses a recorded response. It retrieves the current value, so repeatability is procedural rather than a promise of identical live data. Public GitHub Actions standard runners are free; no paid services, larger runners, artifact uploads, package publication or deployment are configured.
