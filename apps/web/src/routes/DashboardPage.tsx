import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';
import type {
  ApiCredential,
  AutomationRule,
  CalendarEvent,
  Domain,
  EmailMessage,
  Folder,
  ManagedUser,
  Task,
  Tenant,
} from '../lib/types';

interface QuickLink {
  to: string;
  label: string;
  icon: string;
}

const QUICK_LINKS_BY_ROLE: Record<'super_admin' | 'tenant_admin' | 'end_user', QuickLink[]> = {
  super_admin: [
    { to: '/admin/tenants', label: 'Manajemen Tenant', icon: '🏢' },
    { to: '/admin/users', label: 'Manajemen User', icon: '👤' },
    { to: '/admin/packages', label: 'Manajemen Paket', icon: '📦' },
    { to: '/admin/integrations', label: 'Integrasi Aplikasi', icon: '📡' },
    { to: '/inbox', label: 'Mail', icon: '📥' },
    { to: '/template', label: 'Template', icon: '🎨' },
    { to: '/calendar', label: 'Kalender', icon: '📅' },
    { to: '/tasks', label: 'Tugas', icon: '✅' },
    { to: '/automation-rules', label: 'Automation', icon: '🤖' },
  ],
  tenant_admin: [
    { to: '/inbox', label: 'Mail', icon: '📥' },
    { to: '/template', label: 'Template', icon: '🎨' },
    { to: '/admin/domains', label: 'Manajemen Domain', icon: '🌐' },
    { to: '/admin/users', label: 'Manajemen User', icon: '👤' },
    { to: '/admin/packages', label: 'Manajemen Paket', icon: '📦' },
    { to: '/admin/integrations', label: 'Integrasi Aplikasi', icon: '📡' },
    { to: '/calendar', label: 'Kalender', icon: '📅' },
    { to: '/tasks', label: 'Tugas', icon: '✅' },
    { to: '/automation-rules', label: 'Automation', icon: '🤖' },
  ],
  end_user: [
    { to: '/inbox', label: 'Mail', icon: '📥' },
    { to: '/template', label: 'Template', icon: '🎨' },
    { to: '/calendar', label: 'Kalender', icon: '📅' },
    { to: '/tasks', label: 'Tugas', icon: '✅' },
    { to: '/automation-rules', label: 'Automation', icon: '🤖' },
  ],
};

interface StatTile {
  label: string;
  value: string;
  hint?: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [tiles, setTiles] = useState<StatTile[] | null>(null);

  useEffect(() => {
    if (!user) return;

    (async () => {
      if (user.role === 'super_admin') {
        const [tenantsRes, usersRes] = await Promise.allSettled([
          api.get<Tenant[]>('/tenants'),
          api.get<ManagedUser[]>('/users'),
        ]);
        const tenants = tenantsRes.status === 'fulfilled' ? tenantsRes.value : [];
        const users = usersRes.status === 'fulfilled' ? usersRes.value : [];
        setTiles([
          { label: 'Total Tenant', value: String(tenants.length) },
          {
            label: 'Tenant Aktif',
            value: String(tenants.filter((t) => t.billingStatus === 'active').length),
          },
          { label: 'Total User', value: String(users.length) },
        ]);
        return;
      }

      if (user.role === 'tenant_admin' && user.tenantId) {
        const [domainsRes, usersRes, credsRes, rulesRes] = await Promise.allSettled([
          api.get<Domain[]>(`/domains?tenantId=${user.tenantId}`),
          api.get<ManagedUser[]>('/users'),
          api.get<ApiCredential[]>('/auth/api-credentials'),
          api.get<AutomationRule[]>('/automation-rules'),
        ]);
        const domains = domainsRes.status === 'fulfilled' ? domainsRes.value : [];
        const users = usersRes.status === 'fulfilled' ? usersRes.value : [];
        const creds = credsRes.status === 'fulfilled' ? credsRes.value : [];
        const rules = rulesRes.status === 'fulfilled' ? rulesRes.value : [];
        const verifiedDomains = domains.filter((d) => d.verificationStatus === 'verified').length;
        const quotaUsedToday = creds.reduce((sum, c) => sum + c.emailsSentToday, 0);

        setTiles([
          { label: 'Domain Terverifikasi', value: `${verifiedDomains}/${domains.length}` },
          { label: 'Total User', value: String(users.length) },
          { label: 'Email Terkirim Hari Ini (API)', value: String(quotaUsedToday) },
          { label: 'Automation Aktif', value: String(rules.filter((r) => r.isActive).length) },
        ]);
        return;
      }

      // end_user
      const [foldersRes, tasksRes, eventsRes] = await Promise.allSettled([
        api.get<Folder[]>('/folders'),
        api.get<Task[]>('/tasks'),
        api.get<CalendarEvent[]>('/calendar-events'),
      ]);

      let unreadCount = 0;
      if (foldersRes.status === 'fulfilled') {
        const inbox = foldersRes.value.find((f) => f.folderType === 'inbox');
        if (inbox) {
          try {
            const emails = await api.get<EmailMessage[]>(`/emails/folder/${inbox.id}`);
            unreadCount = emails.filter((e) => !e.isRead).length;
          } catch {
            unreadCount = 0;
          }
        }
      }

      const tasks = tasksRes.status === 'fulfilled' ? tasksRes.value : [];
      const events = eventsRes.status === 'fulfilled' ? eventsRes.value : [];
      const todayKey = new Date().toDateString();
      const todaysEvents = events.filter((e) => new Date(e.startTime).toDateString() === todayKey);

      setTiles([
        { label: 'Email Belum Dibaca', value: String(unreadCount) },
        { label: 'Tugas Belum Selesai', value: String(tasks.filter((t) => t.status !== 'done').length) },
        { label: 'Acara Hari Ini', value: String(todaysEvents.length) },
      ]);
    })().catch(() => setTiles([]));
  }, [user]);

  if (!user) return null;

  const quickLinks = QUICK_LINKS_BY_ROLE[user.role];
  const ROLE_GREETING: Record<typeof user.role, string> = {
    super_admin: 'Ringkasan platform SendagoMail',
    tenant_admin: 'Ringkasan tenant Anda',
    end_user: 'Ringkasan aktivitas Anda',
  };

  return (
    <div className="page dashboard-page">
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>
      <p className="auth-subtitle" style={{ margin: 0 }}>
        {ROLE_GREETING[user.role]} — masuk sebagai <strong>{user.email}</strong>
      </p>

      <div className="dashboard-tiles">
        {tiles === null && <div className="dashboard-tile-loading">Memuat ringkasan…</div>}
        {tiles?.map((tile) => (
          <div key={tile.label} className="dashboard-tile">
            <div className="dashboard-tile-value">{tile.value}</div>
            <div className="dashboard-tile-label">{tile.label}</div>
          </div>
        ))}
      </div>

      <h2 className="dashboard-section-title">Menu Cepat</h2>
      <div className="dashboard-quick-links">
        {quickLinks.map((link) => (
          <Link key={link.to} to={link.to} className="dashboard-quick-link">
            <span className="dashboard-quick-link-icon">{link.icon}</span>
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
