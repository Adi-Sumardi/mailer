import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth, type CurrentUser } from '../context/AuthContext';

const NAV_BY_ROLE: Record<CurrentUser['role'], { to: string; label: string }[]> = {
  super_admin: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/admin/tenants', label: 'Manajemen Tenant' },
    { to: '/admin/users', label: 'Manajemen User' },
    { to: '/admin/packages', label: 'Manajemen Paket' },
    { to: '/admin/integrations', label: 'Integrasi Aplikasi' },
    { to: '/inbox', label: 'Mail' },
    { to: '/calendar', label: 'Kalender' },
    { to: '/tasks', label: 'Tugas' },
    { to: '/automation-rules', label: 'Automation' },
  ],
  tenant_admin: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/inbox', label: 'Mail' },
    { to: '/admin/domains', label: 'Manajemen Domain' },
    { to: '/admin/users', label: 'Manajemen User' },
    { to: '/admin/packages', label: 'Manajemen Paket' },
    { to: '/admin/integrations', label: 'Integrasi Aplikasi' },
    { to: '/calendar', label: 'Kalender' },
    { to: '/tasks', label: 'Tugas' },
    { to: '/automation-rules', label: 'Automation' },
  ],
  end_user: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/inbox', label: 'Mail' },
    { to: '/calendar', label: 'Kalender' },
    { to: '/tasks', label: 'Tugas' },
    { to: '/automation-rules', label: 'Automation' },
  ],
};

const ROLE_LABEL: Record<CurrentUser['role'], string> = {
  super_admin: 'Super Admin',
  tenant_admin: 'Tenant Admin',
  end_user: 'End User',
};

function initialsFor(email: string): string {
  const local = email.split('@')[0] ?? email;
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const navItems = user ? NAV_BY_ROLE[user.role] : [];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/logo.png" alt="" className="sidebar-brand-logo" />
          SendagoMail
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <div className="app-topbar-spacer" />
          {user && (
            <div className="app-topbar-user">
              <span className="sidebar-role-badge">{ROLE_LABEL[user.role]}</span>
              <div className="app-topbar-avatar" aria-hidden="true">
                {initialsFor(user.email)}
              </div>
              <span className="app-topbar-email">{user.email}</span>
              <button className="btn-ghost" onClick={handleLogout}>
                Keluar
              </button>
            </div>
          )}
        </header>
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
