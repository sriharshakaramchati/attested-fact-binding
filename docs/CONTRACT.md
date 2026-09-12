# Contract v1

This document describes the executable LOCAL_SOFTWARE wire contract. It does not redefine Popcorn's native proof as a local signature. [DEPENDENCIES.md](DEPENDENCIES.md) describes the separate unavailable hardware interface.

## Bytes and commitments

All protocol JSON is canonical: printable ASCII strings, booleans, null, safe integer numbers (no negative zero), arrays, and plain objects. Object keys sort by ascending JavaScript string comparison; because keys are ASCII this is byte order. Encode using `JSON.stringify` string escaping, commas/colons without spaces, and UTF-8 without BOM or trailing newline. Reject unknown fields on the specified schemas. `parseCanonical` requires exact round-trip byte equality. Source JSON has separate strict duplicate-key parsing and fatal UTF-8 decoding, and is not reserialized before hashing.

`C(v)` is the canonical UTF-8 JSON encoding. `P(D,b) = ASCII("AFB/1/" + D) || 0x00 || b`. `H(D,b) = lowercase_hex(SHA256(P(D,b)))`. `H(D,object)` means `H(D,C(object))`. There is no length prefix: the domain is fixed by the verifier and its terminating zero is unambiguous. Signatures are standard Ed25519 over `P(D,C(claims))`, represented in canonical padded base64. Public keys are Ed25519 SPKI DER in canonical padded base64. Cryptographic private keys are generated in memory, never serialized.

| Field | Definition |
| --- | --- |
| `fact_sha256` | `H("fact", C(fact))` |
| `response_sha256` | `H("response", decoded_response_body_bytes)` |
| `workload_sha256` | `H("workload", C(measurement))` |
| `run_sha256` | `H("run", C(run_certificate.claims))` |
| `prover_id` | `H("run-key", ASCII(run_public_key_base64))`; identifies the certified capture signer, not an inference business |
| `input_sha256` | plain `SHA256(canonical_input_bytes)`, lowercase hex |
| `model_sha256` | plain `SHA256(approved_ONNX_bytes)`, lowercase hex |
| `request_sha256` | `H("inference-request", C(inference_request))` |

The fact has exactly `{field, schema, source, value}`. Values must be `field="repository.archived"`, `schema="afb.fact/1"`, `source="https://api.github.com/repos/zkonduit/ezkl"`, and an actual JSON boolean. Source `full_name` must equal `zkonduit/ezkl` and `archived` must be a boolean. The response is public. Identical facts yield identical commitments across runs; the receipt supplies the separate run binding.

Model preprocessing maps false to integer 0 and true to integer 1. The only accepted input encodings are the exact strings `{"input_data":[[0]]}` and `{"input_data":[[1]]}`. Float/string/shape variants are rejected. Both scores and input are public.

Test vectors for the exact fact schema/source above:

| Value | `fact_sha256` | `input_sha256` |
| --- | --- | --- |
| false | `55ce2025d9a68cb17c2ca02dfd876332196b50b40a9ac0caf1783143c3f7dfcc` | `e7850dbde2dbc7cb3dca52737fa11b6297f5fd323ebd23f0112d9d0ff78735ed` |
| true | `779e89ae95ea72128c96861f67ea6f23413c185ea9bd22bea1d90437358b964b` | `0faefe3ab0b3f2ee95e328a413c090d55f91dfe455638cf7e960824ebb2d9bb5` |

## Exact software-attestation schemas

All hashes/nonces/run IDs below are 64 lowercase hex characters. Time values are integer Unix seconds. Version is integer 1. Code enforces the schema with exact-key checks; none of the objects below is an extensible metadata bag.

```text
Challenge = {
  version, nonce, run_id, issued_at, expires_at
}

Policy = {
  version, profile: "LOCAL_SOFTWARE", authority_public_key,
  workload_sha256, model_sha256
}

Measurement = {
  version, files: {relative_source_path: file_sha256, ...},
  node_version, node_sha256, chromium_sha256
}

RunCertificate = {
  claims: {
    version, profile: "LOCAL_SOFTWARE", audience: "afb-verifier/1",
    nonce, run_id, issued_at, expires_at, workload_sha256, run_public_key
  },
  signature  // authority Ed25519; domain "run-certificate"
}

Receipt = {
  claims: {
    version, run_sha256, run_id, nonce, workload_sha256, prover_id,
    model_sha256, fact_sha256, input_sha256, response_sha256,
    timestamp_s, source, method: "GET", status: 200,
    tls_protocol: "TLS 1.2" | "TLS 1.3", browser_version
  },
  signature  // certified run key Ed25519; domain "run-receipt"
}

BindingBundle = {
  version, measurement, attestation: RunCertificate, receipt: Receipt,
  fact_canonical: string, response_base64: string
}

Envelope = {binding: BindingBundle, inference: InferenceResponse}
```

Measurement is a hash-preimage description, not a dynamic policy: the verifier requires its hash to equal the independently approved workload hash. The local supervisor produces its `files` inventory from every file under `src/`, the lockfile, and approved ONNX identity. Dependencies/OS not fully measured remain documented trust assumptions. Public `Policy` is separate from the submitted envelope. Replacing both an envelope and an untrusted policy must never count as verification under the original relying party's policy.

## Acceptance algorithm

1. Parse outer canonical encoding and exact schemas. Require explicit software-profile opt-in; otherwise fail at the hardware boundary.
2. Validate the authority's run certificate signature and profile/audience. Compare both certificate and measured preimage with the approved workload hash.
3. Check the pinned model identity and current ONNX bytes. Load the verifier-issued challenge matching the signed nonce; compare run ID and times exactly.
4. Verify the receipt signature using the certified run key. Match certificate hash, run ID, nonce, workload, signer identity, model identity, signed timestamp and source metadata.
5. Hash response bytes and compare the signed commitment. Independently parse/extract the fact, compare exact canonical fact bytes, check fact commitment, and recompute canonical input/hash.
6. Validate inference request/response bindings. Accept MOCK only with explicit opt-in and exact deterministic recomputation; never turn it into EZKL verification. Real mode remains unavailable.
7. Atomically create/flush the consumed-nonce marker; only then report PASS. Error or unavailable boundary returns FAIL/nonzero.

`inspectBinding` is read-only inspection, **not acceptance**; it does not consume a nonce. `verifyBinding` and `verifyChain` are accepting APIs and always consume. The CLI uses `verifyChain`. Time window is exactly 600 seconds, with at most 30 seconds future skew as specified in [THREAT_MODEL.md](../THREAT_MODEL.md). Local state is authoritative; a proof's timestamp alone grants nothing.

## Inference partner interface

`prove(request) -> InferenceResponse` is a transport-independent boundary. The future HTTPS service would accept the same request as its JSON POST body. There is no current partner URL. No signing credential is sent to this boundary.

```text
InferenceRequest = {
  version: 1,
  canonical_input: exact canonical input string,
  input_sha256, model_sha256, run_sha256, prover_id
}

InferenceResponse = {
  version: 1, kind: "MOCK" | "EZKL",
  request_sha256, input_sha256, model_sha256, run_sha256, prover_id,
  settings_sha256: null | hash, vk_sha256: null | hash,
  proof: null | native_EZKL_proof_JSON,
  public_instances: string[][],
  scores: [integer, integer], label: "active" | "archived"
}
```

MOCK always has null proof/settings/VK, decimal-string illustrative instances `[[x,1-x,x]]`, and deterministic scores. These MOCK values are not claimed to be an actual EZKL layout. For `EZKL`, the `proof` object and `public_instances` must contain actual unmodified native EZKL output; the separately approved settings determine field encoding, scales, dimensions and layout. The outer schema is common; the mock deliberately does not fabricate native proof bytes.

A future real verifier must compare public instances with `proof.instances`, validate actual EZKL cryptography under approved settings/VK/SRS, decode actual public model input, reproduce the canonical bytes/SHA-256, and bind actual public output to displayed scores/label. Extra metadata or a declared input hash cannot substitute for this. The approved ONNX-to-VK association requires a trusted build/setup manifest. Real inference source inspection found `ezkl.verify(proof_path, settings_path, vk_path, srs_path, reduced_srs)`; selecting a release and generating its settings/layout/artifacts remains integration work.

The browser run is bound by the signed receipt; the inference request hash ties its transport response to this request. Unless run metadata is deliberately constrained as an actual EZKL public input, the model proof would establish computation on the committed input, **not a separate claim of which machine or browser run produced the inference proof**. Reusing a mathematical model proof on the same input is not proof of a fresh inference execution.
