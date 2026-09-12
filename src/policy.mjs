import { canonical, parseJSON, exact, hash, sha256, requireThat } from './canonical.mjs';
export const SOURCE = 'https://api.github.com/repos/zkonduit/ezkl';
export const MODEL = Object.freeze({ version: 1, name: 'archive-affine-v1', input_shape: [1, 1], weights: [-1, 1], bias: [1, 0], labels: ['active', 'archived'] });
export const MODEL_HASH = hash('model', MODEL);
export function extract(body) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(body);
  const source = parseJSON(text);
  requireThat(source && source.full_name === 'zkonduit/ezkl' && typeof source.archived === 'boolean', 'source: wrong repository or invalid archived field');
  return { field: 'repository.archived', schema: 'afb.fact/1', source: SOURCE, value: source.archived };
}
export function validateFact(fact) {
  exact(fact, ['field', 'schema', 'source', 'value'], 'fact');
  requireThat(fact.field === 'repository.archived' && fact.schema === 'afb.fact/1' && fact.source === SOURCE && typeof fact.value === 'boolean', 'fact: schema or source mismatch');
}
export function modelInput(fact) {
  validateFact(fact); return canonical({ input_data: [[Number(fact.value)]] });
}
export const inputHash = fact => sha256(modelInput(fact));
