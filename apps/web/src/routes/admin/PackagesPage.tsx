import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import type { Tenant } from '../../lib/types';

interface PackagePlan {
  id: string;
  name: string;
  price: string;
  dailyEmailLimit: string;
  storage: string;
  features: string[];
  badge: string;
  recommended?: boolean;
}

const PLANS: PackagePlan[] = [
  {
    id: 'free',
    name: 'Starter (Free)',
    price: 'Rp 0 / bulan',
    dailyEmailLimit: '50 email / hari',
    storage: '1 GB Storage',
    badge: 'Grastis',
    features: ['1 Custom Domain', 'Basic SMTP & API Sandbox', 'Standard Webmail UI'],
  },
  {
    id: 'pro',
    name: 'Business Pro',
    price: 'Rp 299.000 / bulan',
    dailyEmailLimit: '5.000 email / hari',
    storage: '10 GB Storage / User',
    badge: 'Popular',
    recommended: true,
    features: [
      'Unlimited Custom Domain',
      'Production API Key (High Quota)',
      'DKIM, SPF & DMARC Automated Setup',
      'Automation Rules & Filter',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise Dedicated',
    price: 'Rp 999.000 / bulan',
    dailyEmailLimit: '50.000 email / hari',
    storage: '50 GB Storage / User',
    badge: 'Scale',
    features: [
      'Dedicated IP Outbound Relay',
      'Custom Rate Limit & Dedicated Queue',
      'SLA 99.9% Availability',
      '24/7 Priority Support',
    ],
  },
];

export default function PackagesPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantInfo, setTenantInfo] = useState<Tenant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [editingPlanMap, setEditingPlanMap] = useState<Record<string, string>>({});

  async function loadData() {
    setError(null);
    try {
      if (isSuperAdmin) {
        const list = await api.get<Tenant[]>('/tenants');
        setTenants(list);
        const map: Record<string, string> = {};
        list.forEach((t) => {
          map[t.id] = t.planType || 'free';
        });
        setEditingPlanMap(map);
      } else if (user?.tenantId) {
        const t = await api.get<Tenant>(`/tenants/${user.tenantId}`);
        setTenantInfo(t);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data paket berlangganan.');
    }
  }

  useEffect(() => {
    loadData();
  }, [isSuperAdmin, user?.tenantId]);

  async function handleChangePlan(tenantId: string, newPlan: string) {
    setError(null);
    setSuccessMsg(null);
    try {
      await api.patch(`/tenants/${tenantId}/plan`, { planType: newPlan });
      setSuccessMsg(`Paket tenant berhasil diperbarui ke '${newPlan.toUpperCase()}'!`);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengubah paket tenant.');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Paket Berlangganan & Kuota Email</h1>
        <p className="auth-subtitle" style={{ margin: 0 }}>
          Pilih paket berlangganan yang sesuai dengan kebutuhan kapasitas dan kuota pengiriman email bisnis Anda.
        </p>
      </div>

      {error && <p className="form-error">{error}</p>}
      {successMsg && (
        <p
          className="form-success"
          style={{
            color: 'var(--color-success)',
            background: 'var(--color-success-container)',
            padding: '10px 14px',
            borderRadius: '8px',
            margin: '12px 0',
          }}
        >
          {successMsg}
        </p>
      )}

      {/* Package Tier Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
          marginBottom: '32px',
        }}
      >
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            style={{
              background: 'var(--color-surface-variant)',
              border: plan.recommended
                ? '2px solid var(--color-primary)'
                : '1px solid var(--color-outline-variant)',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              boxShadow: plan.recommended ? '0 4px 20px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {plan.recommended && (
              <span
                style={{
                  position: 'absolute',
                  top: '-12px',
                  right: '20px',
                  background: 'var(--color-primary)',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  textTransform: 'uppercase',
                }}
              >
                Pilihan Terbaik
              </span>
            )}
            <div>
              <span className="badge badge-info" style={{ marginBottom: '8px' }}>
                {plan.badge}
              </span>
              <h3 style={{ margin: '8px 0 4px 0', fontSize: '20px' }}>{plan.name}</h3>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--color-primary)', margin: '12px 0' }}>
                {plan.price}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0', fontSize: '13px', lineHeight: '1.8' }}>
                <li>⚡ <strong>{plan.dailyEmailLimit}</strong></li>
                <li>💾 <strong>{plan.storage}</strong></li>
                {plan.features.map((f, i) => (
                  <li key={i} style={{ opacity: 0.85 }}>✓ {f}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Tabel Manajemen Paket Tenant untuk Super Admin */}
      {isSuperAdmin ? (
        <div>
          <h2 style={{ fontSize: '18px', marginBottom: '14px' }}>Daftar Tenant & Paket Berlangganan</h2>
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nama Tenant</th>
                  <th>Tenant ID</th>
                  <th>Status Billing</th>
                  <th>Paket Berlangganan Saat Ini</th>
                  <th>Ubah Paket</th>
                </tr>
              </thead>
              <tbody>
                {tenants.length === 0 && (
                  <tr>
                    <td colSpan={5} className="email-list-empty">
                      Belum ada tenant terdaftar.
                    </td>
                  </tr>
                )}
                {tenants.map((t) => (
                  <tr key={t.id}>
                    <td><strong>{t.tenantName}</strong></td>
                    <td><code>{t.id.slice(0, 8)}…</code></td>
                    <td>
                      <span className={`badge badge-${t.billingStatus === 'active' ? 'success' : 'pending'}`}>
                        {t.billingStatus === 'active' ? 'Aktif' : t.billingStatus}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ textTransform: 'uppercase' }}>
                        {t.planType || 'FREE'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <select
                          value={editingPlanMap[t.id] ?? t.planType ?? 'free'}
                          onChange={(e) =>
                            setEditingPlanMap({ ...editingPlanMap, [t.id]: e.target.value })
                          }
                          style={{ padding: '6px 10px', borderRadius: '6px' }}
                        >
                          <option value="free">Starter (Free)</option>
                          <option value="pro">Business Pro</option>
                          <option value="enterprise">Enterprise</option>
                        </select>
                        <button
                          className="btn-primary"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => handleChangePlan(t.id, editingPlanMap[t.id] ?? 'free')}
                        >
                          Simpan
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : tenantInfo ? (
        <div style={{ background: 'var(--color-surface-variant)', padding: '20px', borderRadius: '12px' }}>
          <h3>Status Paket Berlangganan Tenant Anda</h3>
          <p>
            Saat ini organisasi Anda <strong>{tenantInfo.tenantName}</strong> terdaftar pada paket{' '}
            <strong style={{ textTransform: 'uppercase', color: 'var(--color-primary)' }}>{tenantInfo.planType || 'FREE'}</strong>.
          </p>
        </div>
      ) : null}
    </div>
  );
}
