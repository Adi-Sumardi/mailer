import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// Enkripsi simetris (AES-256-GCM) untuk API key AI agent milik tenant — TIDAK PERNAH
// disimpan/dikembalikan plaintext lewat API. Kunci enkripsi diturunkan (scrypt) dari
// env AI_KEY_ENCRYPTION_SECRET, terpisah dari JWT_SECRET/INTERNAL_API_KEY supaya rotasi
// independen. Format simpan: "<iv>:<authTag>:<ciphertext>" (semua base64).
const ALGORITHM = 'aes-256-gcm';

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, 'sendagomail-ai-agent-key', 32);
}

export function encryptApiKey(plaintext: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptApiKey(stored: string, secret: string): string {
  const [ivB64, authTagB64, cipherB64] = stored.split(':');
  const key = deriveKey(secret);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherB64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

// Buat ditampilkan di UI tanpa membocorkan key asli, mis. "sk-...aB3x".
export function maskApiKey(plaintext: string): string {
  if (plaintext.length <= 8) return '••••••••';
  return `${plaintext.slice(0, 4)}••••${plaintext.slice(-4)}`;
}
