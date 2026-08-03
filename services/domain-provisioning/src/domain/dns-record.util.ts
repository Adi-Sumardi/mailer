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

// FR-03: rekomendasi SPF record — default "-all" (hard fail) selaras mitigasi risiko spam di BRD.
// outboundRelayIp = IP mail-engine yang sungguhan mengirim (WAJIB diisi di production lewat
// env OUTBOUND_RELAY_IP — tanpa ini SPF yang direkomendasikan tidak mengotorisasi pengirim
// sungguhan). outboundRelayHost opsional kalau nanti ada shared SPF include record terpisah.
export function buildSpfRecord(outboundRelayHost?: string, outboundRelayIp?: string): string {
  const ip = outboundRelayIp ? ` ip4:${outboundRelayIp}` : '';
  const includes = outboundRelayHost ? ` include:${outboundRelayHost}` : '';
  return `v=spf1${ip}${includes} -all`;
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
// Menggunakan resolver eksplisit (8.8.8.8, 1.1.1.1) agar tidak bergantung pada DNS
// sistem Docker container yang bisa berbeda dari DNS publik.
export async function verifyDomainTxtRecord(
  domainName: string,
  prefix: string,
  token: string,
): Promise<boolean> {
  const { Resolver } = await import('dns');
  const resolver = new Resolver();
  resolver.setServers(['8.8.8.8', '1.1.1.1']);

  const expected = `${prefix}=${token}`;
  try {
    const records = await new Promise<string[][]>((resolve, reject) => {
      resolver.resolveTxt(domainName, (err, addresses) => {
        if (err) reject(err);
        else resolve(addresses);
      });
    });
    return records.some((chunks) => chunks.join('').trim() === expected);
  } catch {
    // NXDOMAIN atau tidak ada TXT record sama sekali → gagal verifikasi, bukan error sistem
    return false;
  }
}
