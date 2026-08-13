import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

// Nama transport di Postfix master.cf (lihat mail-engine/config/user-patches.sh).
const INGEST_TRANSPORT = 'sendago-ingest:';

const GENERATED_HEADER = `# DI-GENERATE OTOMATIS oleh domain-provisioning dari database — jangan edit manual,
# perubahan akan tertimpa saat domain berikutnya ditambahkan atau service restart.`;

// Menulis dua peta Postfix yang membuat email MASUK untuk domain tenant diterima dan
// diserahkan ke aplikasi:
//
//   sendago-tenant-domains.cf -> relay_domains  (Postfix mau menerima email untuk domain ini)
//   sendago-transport.cf      -> transport_maps (rutekan ke pipe sendago-ingest)
//
// Tanpa keduanya, Postfix menolak email ke domain tenant dengan "Relay access denied" /
// "loops back to myself" — MX menunjuk ke server ini tapi server tidak merasa bertanggung
// jawab atas domain tersebut.
//
// Ditulis PENUH dari daftar yang diberikan (bukan patch baris per baris) supaya idempotent
// dan tidak rapuh terhadap isi file sebelumnya. Pemanggil wajib menyediakan daftar LENGKAP
// domain — sama seperti regenerateDkimSigningConfig di dkim-handoff.util.ts.
export async function regeneratePostfixTenantMaps(params: {
  mapsDir: string;
  domainNames: string[];
}): Promise<{ domainsPath: string; transportPath: string }> {
  const { mapsDir, domainNames } = params;
  await mkdir(mapsDir, { recursive: true });

  // texthash: dibaca Postfix langsung sebagai teks — tidak perlu `postmap`, jadi perubahan
  // langsung berlaku tanpa langkah kompilasi maupun restart container.
  const domainsPath = join(mapsDir, 'sendago-tenant-domains.cf');
  await writeFile(
    domainsPath,
    `# Domain tenant yang email masuknya diterima server ini (peta relay_domains, texthash).\n${GENERATED_HEADER}\n` +
      domainNames.map((d) => `${d} OK`).join('\n') +
      (domainNames.length ? '\n' : ''),
  );

  const transportPath = join(mapsDir, 'sendago-transport.cf');
  await writeFile(
    transportPath,
    `# Rute domain tenant ke transport sendago-ingest (peta transport_maps, texthash).\n${GENERATED_HEADER}\n` +
      domainNames.map((d) => `${d} ${INGEST_TRANSPORT}`).join('\n') +
      (domainNames.length ? '\n' : ''),
  );

  return { domainsPath, transportPath };
}
