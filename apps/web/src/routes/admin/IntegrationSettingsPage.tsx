import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import type { ApiCredential, ApiCredentialWithSecret, Tenant } from '../../lib/types';
import IntegrationCodeSamples from '../../components/IntegrationCodeSamples';

const API_BASE_URL = 'https://sendagomail.adilabs.id';

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

      {/* Dokumentasi REST API — bukan SMTP. Endpoint /emails/api-send memvalidasi
          memberId+secret ke auth-service, mengonsumsi kuota, lalu mengirim lewat mailbox
          yang terikat ke credential (lihat ApiCredentialService.resolveMailboxId di backend). */}
      <IntegrationCodeSamples
        baseUrl={API_BASE_URL}
        exampleMemberId={newCredential?.memberId ?? credentials[0]?.memberId ?? 'MEMBER_ID_ANDA'}
        exampleSecret={newCredential?.secret}
      />

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
