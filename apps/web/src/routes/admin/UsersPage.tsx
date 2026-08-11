import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import type { ManagedUser, Tenant } from '../../lib/types';

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantFilter, setSelectedTenantFilter] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form tambah user
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'super_admin' | 'tenant_admin' | 'end_user'>('end_user');
  const [newTenantId, setNewTenantId] = useState('');

  // Form edit user
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<'super_admin' | 'tenant_admin' | 'end_user'>('end_user');
  const [editTenantId, setEditTenantId] = useState('');

  async function loadUsers() {
    let url = '/users';
    if (isSuperAdmin && selectedTenantFilter) {
      url += `?tenantId=${selectedTenantFilter}`;
    }
    const data = await api.get<ManagedUser[]>(url);
    setUsers(data);
  }

  async function loadTenants() {
    if (isSuperAdmin) {
      try {
        const list = await api.get<Tenant[]>('/tenants');
        setTenants(list);
        if (list.length > 0 && !newTenantId) {
          setNewTenantId(list[0].id);
        }
      } catch {
        // ignore
      }
    }
  }

  useEffect(() => {
    loadTenants();
  }, [isSuperAdmin]);

  useEffect(() => {
    loadUsers().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Gagal memuat daftar user.'),
    );
  }, [selectedTenantFilter]);

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    try {
      const payload: any = {
        email: newEmail,
        password: newPassword,
        role: newRole,
      };
      if (newRole !== 'super_admin') {
        payload.tenantId = isSuperAdmin ? newTenantId : currentUser?.tenantId;
      }

      await api.post<ManagedUser>('/users', payload);
      setSuccessMsg(`User ${newEmail} berhasil dibuat!`);
      setNewEmail('');
      setNewPassword('');
      setShowAddForm(false);
      await loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membuat user.');
    }
  }

  function startEdit(u: ManagedUser) {
    setEditingUser(u);
    setEditEmail(u.email);
    setEditPassword('');
    setEditRole(u.role);
    setEditTenantId(u.tenantId ?? (tenants[0]?.id || ''));
    setError(null);
    setSuccessMsg(null);
  }

  async function handleUpdateUser(e: FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setError(null);
    setSuccessMsg(null);
    try {
      const payload: any = {
        email: editEmail,
        role: editRole,
      };
      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }
      if (editRole !== 'super_admin' && editTenantId) {
        payload.tenantId = editTenantId;
      }

      await api.patch(`/users/${editingUser.id}`, payload);
      setSuccessMsg(`User ${editEmail} berhasil diperbarui!`);
      setEditingUser(null);
      await loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memperbarui user.');
    }
  }

  async function handleDeleteUser(u: ManagedUser) {
    if (!confirm(`Yakin ingin menghapus user ${u.email}?`)) return;
    setError(null);
    setSuccessMsg(null);
    try {
      await api.delete(`/users/${u.id}`);
      setSuccessMsg(`User ${u.email} berhasil dihapus!`);
      await loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menghapus user.');
    }
  }

  const roleBadge: Record<ManagedUser['role'], string> = {
    super_admin: 'badge-danger',
    tenant_admin: 'badge-warning',
    end_user: 'badge-info',
  };

  const roleLabel: Record<ManagedUser['role'], string> = {
    super_admin: 'Super Admin',
    tenant_admin: 'Tenant Admin',
    end_user: 'End User',
  };

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Manajemen User & Password</h1>
          <p className="auth-subtitle" style={{ margin: 0 }}>
            Kelola email member, perbarui password, dan ubah hak akses role per tenant.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Batal' : '+ Tambah User'}
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}
      {successMsg && <p className="form-success" style={{ color: 'var(--color-success)', background: 'var(--color-success-container)', padding: '10px 14px', borderRadius: '8px', margin: '12px 0' }}>{successMsg}</p>}

      {/* Form Tambah User */}
      {showAddForm && (
        <form className="inline-form" onSubmit={handleCreateUser} style={{ flexWrap: 'wrap', gap: '12px', background: 'var(--color-surface-variant)', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
          <label>
            Email User
            <input required type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="nama@domain.com" />
          </label>
          <label>
            Password
            <input required type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 8 karakter" />
          </label>
          <label>
            Role
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as any)}>
              <option value="end_user">End User</option>
              <option value="tenant_admin">Tenant Admin</option>
              {isSuperAdmin && <option value="super_admin">Super Admin</option>}
            </select>
          </label>
          {isSuperAdmin && newRole !== 'super_admin' && (
            <label>
              Tenant
              <select value={newTenantId} onChange={(e) => setNewTenantId(e.target.value)} required>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.tenantName}</option>
                ))}
              </select>
            </label>
          )}
          <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-end' }}>
            Simpan User
          </button>
        </form>
      )}

      {/* Modal / Form Edit User */}
      {editingUser && (
        <div className="credential-reveal" style={{ background: 'var(--color-surface-variant)', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--color-primary)' }}>
          <div className="credential-reveal-header" style={{ marginBottom: '14px' }}>
            <strong>Edit User: {editingUser.email}</strong>
            <button className="btn-ghost" onClick={() => setEditingUser(null)}>✕</button>
          </div>
          <form className="inline-form" onSubmit={handleUpdateUser} style={{ flexWrap: 'wrap', gap: '12px' }}>
            <label>
              Email User
              <input required type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </label>
            <label>
              Password Baru (Kosongkan jika tidak diubah)
              <input type="password" minLength={8} value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Password baru" />
            </label>
            <label>
              Role
              <select value={editRole} onChange={(e) => setEditRole(e.target.value as any)}>
                <option value="end_user">End User</option>
                <option value="tenant_admin">Tenant Admin</option>
                {isSuperAdmin && <option value="super_admin">Super Admin</option>}
              </select>
            </label>
            {isSuperAdmin && editRole !== 'super_admin' && (
              <label>
                Tenant
                <select value={editTenantId} onChange={(e) => setEditTenantId(e.target.value)}>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.tenantName}</option>
                  ))}
                </select>
              </label>
            )}
            <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-end' }}>
              Simpan Perubahan
            </button>
          </form>
        </div>
      )}

      {/* Filter per Tenant untuk Super Admin */}
      {isSuperAdmin && (
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ margin: 0, fontWeight: 500 }}>Filter Tenant:</label>
          <select value={selectedTenantFilter} onChange={(e) => setSelectedTenantFilter(e.target.value)} style={{ padding: '6px 12px', borderRadius: '8px' }}>
            <option value="">Semua Tenant</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.tenantName}</option>
            ))}
          </select>
        </div>
      )}

      {/* Tabel Users */}
      <div className="table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              {isSuperAdmin && <th>Tenant</th>}
              <th>Mailbox ID</th>
              <th>Terdaftar</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={isSuperAdmin ? 6 : 5} className="email-list-empty">
                  Belum ada user.
                </td>
              </tr>
            )}
            {users.map((u) => {
              const tenant = tenants.find((t) => t.id === u.tenantId);
              return (
                <tr key={u.id}>
                  <td><strong>{u.email}</strong></td>
                  <td>
                    <span className={`badge ${roleBadge[u.role] ?? 'badge-pending'}`}>
                      {roleLabel[u.role] ?? u.role}
                    </span>
                  </td>
                  {isSuperAdmin && <td>{u.role === 'super_admin' ? '— (Global)' : (tenant?.tenantName ?? '—')}</td>}
                  <td>
                    {u.mailboxId ? <code>{u.mailboxId.slice(0, 8)}…</code> : <span style={{ color: 'var(--color-on-surface-variant)' }}>Tanpa Mailbox</span>}
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString('id-ID')}</td>
                  <td>
                    <div className="task-card-actions">
                      <button className="btn-ghost" onClick={() => startEdit(u)}>
                        Edit Email/Password
                      </button>
                      <button className="btn-danger" onClick={() => handleDeleteUser(u)}>
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
