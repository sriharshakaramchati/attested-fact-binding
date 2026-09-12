import { createHash } from 'node:crypto';

export function requireThat(ok, reason) { if (!ok) throw new Error(reason); }
export function exact(value, keys, label) {
  requireThat(value && typeof value === 'object' && !Array.isArray(value), `${label}: expected object`);
  requireThat(Object.keys(value).sort().join('|') === [...keys].sort().join('|'), `${label}: schema mismatch`);
}
export function canonical(value, depth = 0) {
  requireThat(depth < 40, 'canonical: excessive depth');
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    requireThat(Number.isSafeInteger(value) && !Object.is(value, -0), 'canonical: integer required');
    return String(value);
  }
  if (typeof value === 'string') {
    requireThat(/^[\x20-\x7e]*$/.test(value), 'canonical: printable ASCII string required');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(x => canonical(x, depth + 1)).join(',')}]`;
  requireThat(value && Object.getPrototypeOf(value) === Object.prototype, 'canonical: plain object required');
  return `{${Object.keys(value).sort().map(k => `${canonical(k)}:${canonical(value[k], depth + 1)}`).join(',')}}`;
}

// A small strict JSON parser, also used on the real source response. JSON.parse alone
// silently discards duplicate fields, which would make extraction ambiguous.
export function parseJSON(text) {
  requireThat(typeof text === 'string' && Buffer.byteLength(text) <= 1024 * 1024, 'JSON: size limit');
  let i = 0;
  const ws = () => { while (/[\x20\t\n\r]/.test(text[i] ?? '\0')) i++; };
  function string() {
    const start = i++;
    while (i < text.length) {
      const c = text[i++];
      if (c === '\\') i++;
      else if (c === '"') return JSON.parse(text.slice(start, i));
    }
    throw new Error('JSON: unterminated string');
  }
  function value(depth = 0) {
    requireThat(depth < 40, 'JSON: excessive depth'); ws();
    if (text[i] === '"') return string();
    if (text[i] === '{') {
      i++; ws(); const result = {}; const keys = new Set();
      if (text[i] === '}') { i++; return result; }
      while (true) {
        requireThat(text[i] === '"', 'JSON: expected key'); const k = string();
        requireThat(!keys.has(k), 'JSON: duplicate key'); keys.add(k); ws();
        requireThat(text[i++] === ':', 'JSON: expected colon');
        Object.defineProperty(result, k, { value: value(depth + 1), enumerable: true, writable: true }); ws();
        const c = text[i++]; if (c === '}') return result;
        requireThat(c === ',', 'JSON: expected comma'); ws();
      }
    }
    if (text[i] === '[') {
      i++; ws(); const result = []; if (text[i] === ']') { i++; return result; }
      while (true) {
        result.push(value(depth + 1)); ws(); const c = text[i++];
        if (c === ']') return result; requireThat(c === ',', 'JSON: expected comma');
      }
    }
    const match = /^(true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(text.slice(i));
    requireThat(match, 'JSON: invalid value'); i += match[0].length; return JSON.parse(match[0]);
  }
  const result = value(); ws(); requireThat(i === text.length, 'JSON: trailing data'); return result;
}
export function parseCanonical(text) {
  const result = parseJSON(text);
  requireThat(canonical(result) === text, 'canonical: noncanonical serialization'); return result;
}
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const domainBytes = (domain, bytes) => Buffer.concat([Buffer.from(`AFB/1/${domain}\0`, 'ascii'), Buffer.from(bytes)]);
export const hash = (domain, value) => sha256(domainBytes(domain, typeof value === 'string' || Buffer.isBuffer(value) ? value : canonical(value)));
export function decode64(s) {
  requireThat(typeof s === 'string', 'base64: string required'); const b = Buffer.from(s, 'base64');
  requireThat(b.toString('base64') === s, 'base64: noncanonical'); return b;
}
export const hex = s => typeof s === 'string' && /^[0-9a-f]{64}$/.test(s);
