import { readFile } from 'node:fs/promises';
import { parseCanonical } from './canonical.mjs';

// Public verifier errors identify the rejected input, never an OS error/path.
export async function readCanonicalFile(path, label, missing = `${label}: file not found`) {
  let text;
  try { text = await readFile(path, 'utf8'); }
  catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes(error.code)) throw new Error(missing);
    throw new Error(`${label}: file cannot be read`);
  }
  try { return parseCanonical(text); }
  catch { throw new Error(`${label}: malformed canonical JSON`); }
}
