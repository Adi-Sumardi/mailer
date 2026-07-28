import { generateKeyPairSync } from 'crypto';
import { promises as dns } from 'dns';

export interface DkimKeyPair {
  selector: string;
  publicKeyRecord: string;
  privateKeyPem: string;
}

// FR-03: rekomendasi MX record
export function buildMxRecord(mxHost: string, priority: number): string {
  return `${priority} ${mxHost}.`;
}

// FR-03: rekomendasi SPF record — default "-all" (hard fail) selaras mitigasi risiko spam di BRD
export function buildSpfRecord(outboundRelayHost?: string): string {
  const includes = outboundRelayHost ? ` include:${outboundRelayHost}` : '';
  return `v=spf1${includes} -all`;
}

// FR-03: rekomendasi DMARC record — mulai dari kebijakan "quarantine" (lebih aman dari "none")
export function buildDmarcRecord(domainName: string): string {
  return `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@${domainName}; fo=1`;
}

// FR-03: generate keypair DKIM 2048-bit. Private key nanti dipakai Rspamd (mail-engine) untuk signing,
// public key ditampilkan ke user sebagai TXT record `<selector>._domainkey.<domain>`.
export function generateDkimKeyPair(selector = 'sendago'): DkimKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const publicKeyBody = publicKey
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s/g, '');

  return {
    selector,
    publicKeyRecord: `v=DKIM1; k=rsa; p=${publicKeyBody}`,
    privateKeyPem: privateKey,
  };
}

// FR-02: verifikasi kepemilikan domain via TXT record.
// Mengecek TXT record di root domain, mencari nilai persis `${prefix}=${token}`.
export async function verifyDomainTxtRecord(
  domainName: string,
  prefix: string,
  token: string,
): Promise<boolean> {
  const expected = `${prefix}=${token}`;
  try {
    const records = await dns.resolveTxt(domainName);
    return records.some((chunks) => chunks.join('').trim() === expected);
  } catch {
    // NXDOMAIN atau tidak ada TXT record sama sekali → gagal verifikasi, bukan error sistem
    return false;
  }
}
