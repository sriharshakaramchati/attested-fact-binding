import { generateKeyPairSync, createPublicKey, sign, verify } from 'node:crypto';
import { canonical, domainBytes, decode64, exact, requireThat } from './canonical.mjs';
export function keypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'), privateKey };
}
export function signed(domain, claims, privateKey) {
  return { claims, signature: sign(null, domainBytes(domain, canonical(claims)), privateKey).toString('base64') };
}
export function authenticate(domain, statement, publicKey) {
  exact(statement, ['claims', 'signature'], 'signed statement');
  const key = createPublicKey({ key: decode64(publicKey), format: 'der', type: 'spki' });
  requireThat(key.asymmetricKeyType === 'ed25519', 'signature: Ed25519 required');
  requireThat(verify(null, domainBytes(domain, canonical(statement.claims)), key, decode64(statement.signature)), `${domain}: invalid signature`);
  return statement.claims;
}
