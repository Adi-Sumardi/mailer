import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import type { ApiCredential, ApiCredentialWithSecret, Tenant } from '../../lib/types';

export default function IntegrationSettingsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [credentials, setCredentials] = useState<ApiCredential[]>([]);
  const [name, setName] = useState('');
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [newCredential, setNewCredential] = useState<ApiCredentialWithSecret | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadCredentials() {
    setCredentials(await api.get<ApiCredential[]>('/auth/api-credentials'));
  }

  useEffect(() => {
    loadCredentials().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Gagal memuat credential.'),
    );
    // Fetch daftar tenant hanya untuk super_admin (untuk dropdown pilih tenant)
    if (isSuperAdmin) {
      api.get<Tenant[]>('/tenants')
        .then((list) => {
          setTenants(list);
          if (list.length > 0) setSelectedTenantId(list[0].id);
        })
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const body: Record<string, string> = { name, environment };
      // super_admin tidak punya tenantId sendiri — sertakan tenantId yang dipilih
      if (isSuperAdmin) body.tenantId = selectedTenantId;

      const created = await api.post<ApiCredentialWithSecret>('/auth/api-credentials', body);
      setNewCredential(created);
      setName('');
      await loadCredentials();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membuat credential.');
    }
  }

  async function handleRevoke(id: string) {
    await api.delete(`/auth/api-credentials/${id}`);
    await loadCredentials();
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Integrasi Aplikasi</h1>
      </div>
      <p className="auth-subtitle" style={{ margin: 0 }}>
        Buat credential (Member ID + Secret Key) untuk menghubungkan aplikasi eksternal ke SendagoMail.
        <strong> Sandbox</strong> gratis tapi dibatasi kuota kirim email harian — cocok untuk uji coba.{' '}
        <strong>Production</strong> mengikuti kuota paket berlangganan tenant Anda.
      </p>

      {newCredential && (
        <div className="credential-reveal">
          <div className="credential-reveal-header">
            <strong>Credential berhasil dibuat — simpan Secret Key sekarang, tidak akan ditampilkan lagi.</strong>
            <button className="btn-ghost" onClick={() => setNewCredential(null)}>
              ✕
            </button>
          </div>
          <div className="credential-field">
            <span>Member ID</span>
            <code>{newCredential.memberId}</code>
          </div>
          <div className="credential-field">
            <span>Secret Key</span>
            <code>{newCredential.secret}</code>
          </div>
        </div>
      )}

      <form className="inline-form" onSubmit={handleCreate}>
        {/* Dropdown tenant hanya untuk super_admin */}
        {isSuperAdmin && (
          <label>
            Tenant
            <select
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              required
            >
              {tenants.length === 0 && <option value="">Memuat tenant…</option>}
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tenantName}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Nama Credential
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Website Utama" />
        </label>
        <label>
          Environment
          <select value={environment} onChange={(e) => setEnvironment(e.target.value as 'sandbox' | 'production')}>
            <option value="sandbox">Sandbox (gratis, dibatasi)</option>
            <option value="production">Production (sesuai paket)</option>
          </select>
        </label>
        <button type="submit" className="btn-primary">
          Buat Credential
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}

      {/* SendagoMail Transactional SMTP Server Credentials Card */}
      <div
        style={{
          background: 'var(--color-surface-variant)',
          border: '1px solid var(--color-outline-variant)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '32px',
          marginTop: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <h2 style={{ fontSize: '18px', margin: 0 }}>📡 SendagoMail Transactional SMTP Server Credentials</h2>
        </div>
        <p style={{ fontSize: '13px', opacity: 0.85, margin: '0 0 16px 0' }}>
          Gunakan alamat server SMTP SendagoMail di bawah ini pada aplikasi backend Anda (mirip SendGrid / Mailgun / Amazon SES) untuk mengirimkan email transaksional secara otomatis.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div style={{ background: 'var(--color-background)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--color-outline-variant)' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', display: 'block' }}>SMTP HOST</span>
            <code style={{ fontSize: '14px', fontWeight: 'bold' }}>sendagomail.adilabs.id</code>
          </div>

          <div style={{ background: 'var(--color-background)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--color-outline-variant)' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', display: 'block' }}>PORTS</span>
            <code style={{ fontSize: '14px', fontWeight: 'bold' }}>587 (TLS), 465 (SSL), 25</code>
          </div>

          <div style={{ background: 'var(--color-background)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--color-outline-variant)' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', display: 'block' }}>AUTHENTICATION</span>
            <code style={{ fontSize: '14px', fontWeight: 'bold' }}>Member ID & Secret Key</code>
          </div>

          <div style={{ background: 'var(--color-background)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--color-outline-variant)' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', display: 'block' }}>SECURITY & SIGNING</span>
            <code style={{ fontSize: '14px', fontWeight: 'bold' }}>Automated DKIM + SPF</code>
          </div>
        </div>

        {/* Code Snippet Example */}
        <div>
          <strong style={{ fontSize: '13px', display: 'block', marginBottom: '8px' }}>💻 Contoh Kode Integrasi Node.js (Nodemailer):</strong>
          <pre
            style={{
              background: '#1e1e1e',
              color: '#d4d4d4',
              padding: '14px 18px',
              borderRadius: '10px',
              fontSize: '12px',
              overflowX: 'auto',
              margin: 0,
            }}
          >
{`const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'sendagomail.adilabs.id',
  port: 587,
  auth: {
    user: 'MEMBER_ID_ANDA', // Buat credential di tabel bawah
    pass: 'SECRET_KEY_ANDA',
  },
});

await transporter.sendMail({
  from: 'no-reply@domain-anda.com',
  to: 'penerima@gmail.com',
  subject: 'Notifikasi Transaksional SendagoMail',
  text: 'Pesan transaksional berhasil dikirim melalui SendagoMail Engine.',
});`}
          </pre>
        </div>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Nama</th>
            {isSuperAdmin && <th>Tenant</th>}
            <th>Member ID</th>
            <th>Environment</th>
            <th>Kuota Hari Ini</th>
            <th>Status</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {credentials.length === 0 && (
            <tr>
              <td colSpan={isSuperAdmin ? 7 : 6} className="email-list-empty">
                Belum ada credential integrasi.
              </td>
            </tr>
          )}
          {credentials.map((cred) => {
            const tenant = tenants.find((t) => (cred as any).tenantId === t.id);
            return (
              <tr key={cred.id}>
                <td>{cred.name}</td>
                {isSuperAdmin && <td>{tenant?.tenantName ?? '—'}</td>}
                <td>
                  <code>{cred.memberId}</code>
                </td>
                <td>
                  <span className={`badge badge-${cred.environment === 'production' ? 'success' : 'pending'}`}>
                    {cred.environment}
                  </span>
                </td>
                <td>
                  {cred.emailsSentToday} / {cred.dailyEmailLimit}
                </td>
                <td>
                  {cred.revokedAt ? (
                    <span className="badge badge-recalled">Revoked</span>
                  ) : (
                    <span className="badge badge-success">Aktif</span>
                  )}
                </td>
                <td>
                  {!cred.revokedAt && (
                    <button className="btn-danger" onClick={() => handleRevoke(cred.id)}>
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
