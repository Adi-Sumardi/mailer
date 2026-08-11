import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import type { Domain, DnsRecords, Tenant } from '../../lib/types';

// "verified" cuma soal bukti kepemilikan domain (record TXT #1) -- BUKAN indikator email
// sudah siap kirim (butuh MX/SPF/DKIM terpasang juga, lihat peringatan di domain-detail).
const STATUS_LABEL: Record<Domain['verificationStatus'], string> = {
  pending: 'Menunggu Verifikasi',
  verified: 'Kepemilikan Terverifikasi',
  failed: 'Verifikasi Gagal',
};

export default function DomainsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const tenantId = user?.role === 'tenant_admin' ? user.tenantId : searchParams.get('tenantId');

  const [domains, setDomains] = useState<Domain[]>([]);
  const [domainName, setDomainName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [txtInstruction, setTxtInstruction] = useState<{ recordType: string; host: string; value: string } | null>(null);
  const [dnsRecords, setDnsRecords] = useState<DnsRecords | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [tenantInfo, setTenantInfo] = useState<Tenant | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  async function loadDomains() {
    if (!tenantId) return;
    setDomains(await api.get<Domain[]>(`/domains?tenantId=${tenantId}`));
  }

  useEffect(() => {
    loadDomains().catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat domain.'));
    if (tenantId) {
      api.get<Tenant>(`/tenants/${tenantId}`)
        .then((t) => {
          setTenantName(t.tenantName);
          setTenantInfo(t);
        })
        .catch(() => {
          setTenantName(null);
          setTenantInfo(null);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setError(null);
    try {
      await api.post('/domains', { tenantId, domainName });
      setDomainName('');
      await loadDomains();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menambah domain.');
    }
  }

  async function handleExpand(domain: Domain) {
    if (expandedId === domain.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(domain.id);
    const [instructions, records] = await Promise.all([
      api.get<{ recordType: string; host: string; value: string }>(
        `/domains/${domain.id}/verification-instructions`,
      ),
      api.get<DnsRecords>(`/domains/${domain.id}/dns-records`),
    ]);
    setTxtInstruction(instructions);
    setDnsRecords(records);
  }

  async function handleVerify(id: string) {
    await api.post(`/domains/${id}/verify`);
    await loadDomains();
  }

  async function handleDelete(id: string) {
    await api.delete(`/domains/${id}`);
    if (expandedId === id) setExpandedId(null);
    await loadDomains();
  }

  if (!tenantId) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Manajemen Domain</h1>
        </div>
        <p className="email-list-empty">
          Pilih tenant dulu dari halaman <a href="/admin/tenants">Manajemen Tenant</a> (klik "Kelola Domain" di
          baris tenant yang diinginkan).
        </p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          {user?.role === 'super_admin' && (
            <Link
              to="/admin/tenants"
              style={{ fontSize: 13, color: 'var(--color-on-surface-variant)', textDecoration: 'none', display: 'block', marginBottom: 4 }}
            >
              ← Manajemen Tenant
            </Link>
          )}
          <h1>
            Manajemen Domain
            {tenantName && (
              <span style={{ fontSize: 16, fontWeight: 400, color: 'var(--color-on-surface-variant)', marginLeft: 10 }}>
                — {tenantName}
              </span>
            )}
          </h1>
        </div>
      </div>

      {tenantInfo && (
        <div style={{
          marginBottom: '24px',
          background: 'var(--color-surface-variant)',
          border: '1px solid var(--color-outline-variant)',
          borderRadius: '12px',
          padding: '16px 20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--color-on-surface)' }}>
              🏢 Informasi Akun & Tenant
            </h3>
            <span className={`badge badge-${tenantInfo.billingStatus === 'active' ? 'success' : 'pending'}`}>
              {tenantInfo.billingStatus === 'active' ? 'Aktif' : tenantInfo.billingStatus}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', display: 'block', marginBottom: '4px' }}>Nama Tenant</span>
              <strong style={{ fontSize: '14px' }}>{tenantInfo.tenantName}</strong>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', display: 'block', marginBottom: '4px' }}>Tenant ID (untuk Register & API)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <code style={{ fontSize: '12px', background: 'var(--color-surface)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--color-outline-variant)' }}>
                  {tenantInfo.id}
                </code>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ padding: '2px 8px', fontSize: '12px' }}
                  onClick={() => {
                    navigator.clipboard.writeText(tenantInfo.id);
                    setCopiedId(true);
                    setTimeout(() => setCopiedId(false), 2000);
                  }}
                >
                  {copiedId ? '✓ Tersalin' : '📋 Salin'}
                </button>
              </div>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', display: 'block', marginBottom: '4px' }}>Paket</span>
              <strong style={{ fontSize: '14px', textTransform: 'capitalize' }}>{tenantInfo.planType || 'Standard'}</strong>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', display: 'block', marginBottom: '4px' }}>Dibuat Pada</span>
              <span style={{ fontSize: '14px' }}>{new Date(tenantInfo.createdAt).toLocaleDateString('id-ID')}</span>
            </div>
          </div>
        </div>
      )}

      <form className="inline-form" onSubmit={handleCreate}>
        <label>
          Nama Domain
          <input
            required
            value={domainName}
            onChange={(e) => setDomainName(e.target.value)}
            placeholder="contoh.com"
          />
        </label>
        <button type="submit" className="btn-primary">
          Tambah Domain
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}

      <ul className="event-list">
        {domains.length === 0 && <li className="email-list-empty">Belum ada domain untuk tenant ini.</li>}
        {domains.map((domain) => (
          <li key={domain.id} className="domain-item">
            <div className="event-list-item" onClick={() => handleExpand(domain)} style={{ cursor: 'pointer' }}>
              <div>
                <div className="event-title">{domain.domainName}</div>
                <div className="event-time">Ditambahkan {new Date(domain.createdAt).toLocaleDateString('id-ID')}</div>
              </div>
              <div className="task-card-actions">
                <span
                  className={`badge badge-${
                    domain.verificationStatus === 'verified'
                      ? 'success'
                      : domain.verificationStatus === 'failed'
                        ? 'recalled'
                        : 'pending'
                  }`}
                >
                  {STATUS_LABEL[domain.verificationStatus]}
                </span>
              </div>
            </div>

            {expandedId === domain.id && (
              <div className="domain-detail">
                <div
                  className="form-error"
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}
                >
                  <span>⚠️</span>
                  <span>
                    <strong>Tombol "Cek Verifikasi" cuma mengecek record #1</strong> (bukti
                    kepemilikan domain). Badge <strong>"Terverifikasi"</strong> TIDAK berarti
                    email sudah bisa terkirim — record #2, #3, #4 di bawah (MX, SPF, DKIM) juga{' '}
                    <strong>wajib</strong> dipasang di DNS provider domain ini, atau pengiriman
                    email akan ditolak penerima (mis. Gmail) walau status sudah "Terverifikasi".
                  </span>
                </div>

                {txtInstruction && (
                  <div className="dns-record-card">
                    <div className="dns-record-label">
                      1. TXT Record — Bukti Kepemilikan Domain (dicek tombol "Cek Verifikasi")
                    </div>
                    <code>
                      {txtInstruction.host} TXT "{txtInstruction.value}"
                    </code>
                  </div>
                )}
                {dnsRecords && (
                  <>
                    {dnsRecords.mx && (
                      <div className="dns-record-card">
                        <div className="dns-record-label">2. MX Record — wajib, supaya domain ini bisa menerima email</div>
                        <code>{dnsRecords.mx}</code>
                      </div>
                    )}
                    {dnsRecords.spf && (
                      <div className="dns-record-card">
                        <div className="dns-record-label">3. SPF Record (TXT) — wajib, supaya email terkirim tidak ditolak/masuk spam</div>
                        <code>{dnsRecords.spf}</code>
                      </div>
                    )}
                    {dnsRecords.dkim && (
                      <div className="dns-record-card">
                        <div className="dns-record-label">4. DKIM Record (TXT) — wajib, supaya email terkirim tidak ditolak/masuk spam — host: {dnsRecords.dkim.host}</div>
                        <code>{dnsRecords.dkim.value}</code>
                      </div>
                    )}
                    {dnsRecords.dmarc && (
                      <div className="dns-record-card">
                        <div className="dns-record-label">5. DMARC Record (TXT) — disarankan, tidak wajib</div>
                        <code>{dnsRecords.dmarc}</code>
                      </div>
                    )}
                  </>
                )}
                <div className="task-card-actions" style={{ marginTop: 'var(--space-sm)' }}>
                  <button className="btn-primary" onClick={() => handleVerify(domain.id)}>
                    Cek Verifikasi
                  </button>
                  <button className="btn-danger" onClick={() => handleDelete(domain.id)}>
                    Hapus Domain
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
