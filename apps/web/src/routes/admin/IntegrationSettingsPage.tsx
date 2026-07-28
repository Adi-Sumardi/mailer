import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../lib/apiClient';
import type { ApiCredential, ApiCredentialWithSecret } from '../../lib/types';

export default function IntegrationSettingsPage() {
  const [credentials, setCredentials] = useState<ApiCredential[]>([]);
  const [name, setName] = useState('');
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [newCredential, setNewCredential] = useState<ApiCredentialWithSecret | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadCredentials() {
    setCredentials(await api.get<ApiCredential[]>('/auth/api-credentials'));
  }

  useEffect(() => {
    loadCredentials().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Gagal memuat credential.'),
    );
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const created = await api.post<ApiCredentialWithSecret>('/auth/api-credentials', {
        name,
        environment,
      });
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

      <table className="admin-table">
        <thead>
          <tr>
            <th>Nama</th>
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
              <td colSpan={6} className="email-list-empty">
                Belum ada credential integrasi.
              </td>
            </tr>
          )}
          {credentials.map((cred) => (
            <tr key={cred.id}>
              <td>{cred.name}</td>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
