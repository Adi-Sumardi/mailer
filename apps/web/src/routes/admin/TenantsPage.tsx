import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/apiClient';
import type { Tenant } from '../../lib/types';

const STATUS_LABEL: Record<Tenant['billingStatus'], string> = {
  active: 'Aktif',
  suspended: 'Nonaktif',
  cancelled: 'Dibatalkan',
};

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantName, setTenantName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function loadTenants() {
    setTenants(await api.get<Tenant[]>('/tenants'));
  }

  useEffect(() => {
    loadTenants().catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat tenant.'));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/tenants', { tenantName });
      setTenantName('');
      await loadTenants();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membuat tenant.');
    }
  }

  async function handleToggle(tenant: Tenant) {
    const action = tenant.billingStatus === 'active' ? 'deactivate' : 'reactivate';
    await api.patch(`/tenants/${tenant.id}/${action}`);
    await loadTenants();
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/tenants/${id}`);
      await loadTenants();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Gagal menghapus tenant.',
      );
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Manajemen Tenant</h1>
      </div>

      <form className="inline-form" onSubmit={handleCreate}>
        <label>
          Nama Tenant
          <input required value={tenantName} onChange={(e) => setTenantName(e.target.value)} />
        </label>
        <button type="submit" className="btn-primary">
          Buat Tenant
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Nama Tenant</th>
            <th>Status</th>
            <th>Dibuat</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {tenants.length === 0 && (
            <tr>
              <td colSpan={4} className="email-list-empty">
                Belum ada tenant.
              </td>
            </tr>
          )}
          {tenants.map((tenant) => (
            <tr key={tenant.id}>
              <td>{tenant.tenantName}</td>
              <td>
                <span className={`badge badge-${tenant.billingStatus === 'active' ? 'success' : 'pending'}`}>
                  {STATUS_LABEL[tenant.billingStatus]}
                </span>
              </td>
              <td>{new Date(tenant.createdAt).toLocaleDateString('id-ID')}</td>
              <td className="task-card-actions">
                <Link className="btn-ghost" to={`/admin/domains?tenantId=${tenant.id}`}>
                  Kelola Domain
                </Link>
                <button className="btn-ghost" onClick={() => handleToggle(tenant)}>
                  {tenant.billingStatus === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
                <button className="btn-danger" onClick={() => handleDelete(tenant.id)}>
                  Hapus
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
