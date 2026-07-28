import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import type { Domain, DnsRecords } from '../../lib/types';

const STATUS_LABEL: Record<Domain['verificationStatus'], string> = {
  pending: 'Menunggu Verifikasi',
  verified: 'Terverifikasi',
  failed: 'Gagal',
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

  async function loadDomains() {
    if (!tenantId) return;
    setDomains(await api.get<Domain[]>(`/domains?tenantId=${tenantId}`));
  }

  useEffect(() => {
    loadDomains().catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat domain.'));
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
        <h1>Manajemen Domain</h1>
      </div>

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
                {txtInstruction && (
                  <div className="dns-record-card">
                    <div className="dns-record-label">1. Pasang TXT record ini untuk verifikasi kepemilikan:</div>
                    <code>
                      {txtInstruction.host} TXT "{txtInstruction.value}"
                    </code>
                  </div>
                )}
                {dnsRecords && (
                  <>
                    {dnsRecords.mx && (
                      <div className="dns-record-card">
                        <div className="dns-record-label">MX Record</div>
                        <code>{dnsRecords.mx}</code>
                      </div>
                    )}
                    {dnsRecords.spf && (
                      <div className="dns-record-card">
                        <div className="dns-record-label">SPF Record (TXT)</div>
                        <code>{dnsRecords.spf}</code>
                      </div>
                    )}
                    {dnsRecords.dmarc && (
                      <div className="dns-record-card">
                        <div className="dns-record-label">DMARC Record (TXT)</div>
                        <code>{dnsRecords.dmarc}</code>
                      </div>
                    )}
                    {dnsRecords.dkim && (
                      <div className="dns-record-card">
                        <div className="dns-record-label">DKIM Record (TXT) — {dnsRecords.dkim.host}</div>
                        <code>{dnsRecords.dkim.value}</code>
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
