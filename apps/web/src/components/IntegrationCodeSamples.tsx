import { useState } from 'react';

interface IntegrationCodeSamplesProps {
  baseUrl: string;
  exampleMemberId: string;
  exampleSecret?: string;
}

type Lang = 'curl' | 'php' | 'python' | 'node' | 'java';

const LANG_LABEL: Record<Lang, string> = {
  curl: 'cURL',
  php: 'PHP',
  python: 'Python',
  node: 'Node.js',
  java: 'Java',
};

function buildSnippets(baseUrl: string, memberId: string, secret: string): Record<Lang, string> {
  const url = `${baseUrl}/emails/api-send`;

  return {
    curl: `curl -X POST ${url} \\
  -H "Content-Type: application/json" \\
  -d '{
    "memberId": "${memberId}",
    "secret": "${secret}",
    "toAddr": "penerima@gmail.com",
    "subject": "Kode OTP Anda: 123456",
    "body": "Kode OTP Anda adalah 123456. Berlaku 5 menit."
  }'`,

    php: `<?php
$payload = [
    'memberId' => '${memberId}',
    'secret'   => '${secret}',
    'toAddr'   => 'penerima@gmail.com',
    'subject'  => 'Kode OTP Anda: 123456',
    'body'     => 'Kode OTP Anda adalah 123456. Berlaku 5 menit.',
    // 'isHtml' => true, // aktifkan kalau body berupa template HTML mentah
];

$ch = curl_init('${url}');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode($payload),
]);

$response = curl_exec($ch);
$statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($statusCode !== 201) {
    throw new Exception("Gagal kirim email: " . $response);
}

echo $response;`,

    python: `import requests

response = requests.post(
    "${url}",
    json={
        "memberId": "${memberId}",
        "secret": "${secret}",
        "toAddr": "penerima@gmail.com",
        "subject": "Kode OTP Anda: 123456",
        "body": "Kode OTP Anda adalah 123456. Berlaku 5 menit.",
        # "isHtml": True,  # aktifkan kalau body berupa template HTML mentah
    },
)

if response.status_code != 201:
    raise Exception(f"Gagal kirim email: {response.text}")

print(response.json())`,

    node: `const response = await fetch('${url}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    memberId: '${memberId}',
    secret: '${secret}',
    toAddr: 'penerima@gmail.com',
    subject: 'Kode OTP Anda: 123456',
    body: 'Kode OTP Anda adalah 123456. Berlaku 5 menit.',
    // isHtml: true, // aktifkan kalau body berupa template HTML mentah
  }),
});

if (!response.ok) {
  throw new Error(\`Gagal kirim email: \${await response.text()}\`);
}

console.log(await response.json());`,

    java: `HttpClient client = HttpClient.newHttpClient();

String json = """
    {
      "memberId": "${memberId}",
      "secret": "${secret}",
      "toAddr": "penerima@gmail.com",
      "subject": "Kode OTP Anda: 123456",
      "body": "Kode OTP Anda adalah 123456. Berlaku 5 menit."
    }
    """;

HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("${url}"))
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(json))
    .build();

HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
if (response.statusCode() != 201) {
    throw new RuntimeException("Gagal kirim email: " + response.body());
}
System.out.println(response.body());`,
  };
}

export default function IntegrationCodeSamples({
  baseUrl,
  exampleMemberId,
  exampleSecret,
}: IntegrationCodeSamplesProps) {
  const [activeLang, setActiveLang] = useState<Lang>('curl');
  const [copied, setCopied] = useState(false);

  const secret = exampleSecret ?? 'SECRET_ANDA';
  const snippets = buildSnippets(baseUrl, exampleMemberId, secret);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(snippets[activeLang]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API tidak tersedia (mis. http non-secure context) — biarkan user copy manual.
    }
  }

  return (
    <div className="integration-docs">
      <h2 className="integration-docs-title">📡 Integrasi REST API — Kirim Email Transaksional</h2>
      <p className="integration-docs-desc">
        Gunakan endpoint di bawah untuk kirim OTP, reset password, atau notifikasi lain langsung dari
        backend aplikasi Anda. Tidak perlu SMTP — cukup satu HTTP request. Buat credential (Member ID +
        Secret Key) di form atas, lalu ganti nilainya di contoh kode berikut.
      </p>

      <div className="integration-endpoint">
        <span className="integration-endpoint-method">POST</span>
        <code>{baseUrl}/emails/api-send</code>
      </div>

      <div className="integration-params">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Wajib</th>
              <th>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>memberId</code></td>
              <td>Ya</td>
              <td>Member ID credential (didapat saat membuat credential di atas)</td>
            </tr>
            <tr>
              <td><code>secret</code></td>
              <td>Ya</td>
              <td>Secret key credential — simpan aman di server, jangan expose ke client-side</td>
            </tr>
            <tr>
              <td><code>toAddr</code></td>
              <td>Ya</td>
              <td>Alamat email penerima</td>
            </tr>
            <tr>
              <td><code>subject</code></td>
              <td>Ya</td>
              <td>Subjek email</td>
            </tr>
            <tr>
              <td><code>body</code></td>
              <td>Ya</td>
              <td>Isi email — plain text (default) atau HTML mentah</td>
            </tr>
            <tr>
              <td><code>isHtml</code></td>
              <td>Tidak</td>
              <td>
                Set <code>true</code> kalau <code>body</code> berupa template HTML (logo, tombol, dsb).
                Default <code>false</code> — newline di body dianggap plain text dan dikonversi jadi baris baru.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="integration-tabs">
        {(Object.keys(LANG_LABEL) as Lang[]).map((lang) => (
          <button
            key={lang}
            className={`integration-tab${activeLang === lang ? ' active' : ''}`}
            onClick={() => setActiveLang(lang)}
          >
            {LANG_LABEL[lang]}
          </button>
        ))}
      </div>

      <div className="integration-code-block">
        <button className="integration-copy-btn" onClick={handleCopy}>
          {copied ? '✓ Disalin' : 'Salin'}
        </button>
        <pre>
          <code>{snippets[activeLang]}</code>
        </pre>
      </div>

      <div className="integration-response">
        <strong>Respons sukses (HTTP 201):</strong>
        <pre>
          <code>{`{
  "id": "...",
  "fromAddr": "pengirim@domain-anda.com",
  "toAddr": "penerima@gmail.com",
  "sendStatus": "queued",
  "environment": "sandbox",
  "remainingQuota": 49
}`}</code>
        </pre>
        <strong>Respons gagal (HTTP 401) — credential salah atau kuota habis:</strong>
        <pre>
          <code>{`{ "message": "Kuota harian (50) untuk environment 'sandbox' sudah habis", "error": "Unauthorized", "statusCode": 401 }`}</code>
        </pre>
      </div>
    </div>
  );
}
