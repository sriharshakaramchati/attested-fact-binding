import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canonical, parseCanonical, parseJSON, hash, sha256 } from '../src/canonical.mjs';
import { MODEL_HASH, assertModelBytes, modelInput, SOURCE } from '../src/policy.mjs';

test('canonical commitment is independent of insertion order and domain-separated', () => {
  assert.equal(canonical({ b: 2, a: 1 }), '{"a":1,"b":2}');
  assert.equal(hash('fact', { b: 2, a: 1 }), hash('fact', { a: 1, b: 2 }));
  assert.notEqual(hash('fact', { a: 1 }), hash('run', { a: 1 }));
});
for (const malformed of [' {"a":1}', '{"a":1}\n', '{"b":2,"a":1}', '{"a":1,"a":2}', '{"a":-0}', '{"a":1.0}', '{"a":1e0}', '{"a":9007199254740992}', '{"a":"\\u0061"}', '\ufeff{}', '{"a":NaN}', '{"a":1,}', '{"a":"é"}']) {
  test(`REJECT malformed canonical serialization ${JSON.stringify(malformed)}`, () => {
    assert.throws(() => parseCanonical(malformed));
  });
}
test('source JSON parser rejects duplicate and escaped duplicate keys', () => {
  assert.throws(() => parseJSON('{"archived":true,"archived":false}'), /duplicate key/);
  assert.throws(() => parseJSON('{"archived":true,"\\u0061rchived":false}'), /duplicate key/);
  assert.deepEqual(parseJSON(' { "values": [null, true, -2.5, "a\\\"b"] } '), { values: [null, true, -2.5, 'a"b'] });
});
test('model input has exactly two encodings', () => {
  for (const value of [false, true]) assert.equal(modelInput({ schema: 'afb.fact/1', field: 'repository.archived', source: SOURCE, value }), `{"input_data":[[${Number(value)}]]}`);
});
test('real ONNX artifact is pinned; modified model bytes fail', async () => {
  const bytes = await readFile(new URL('../model/classifier.onnx', import.meta.url));
  assert.equal(bytes.length, 218); assert.equal(sha256(bytes), MODEL_HASH); assertModelBytes(bytes);
  const changed = Buffer.from(bytes); changed[changed.length - 1] ^= 1;
  assert.throws(() => assertModelBytes(changed), /model: ONNX bytes/);
});
