import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import RoleRoute from './routes/RoleRoute';
import AppLayout from './components/AppLayout';
import LandingPage from './routes/LandingPage';
import LoginPage from './routes/LoginPage';
import RegisterPage from './routes/RegisterPage';
import DashboardPage from './routes/DashboardPage';
import InboxPage from './routes/InboxPage';
import TemplatePage from './routes/TemplatePage';
import CalendarPage from './routes/CalendarPage';
import TasksPage from './routes/TasksPage';
import AutomationRulesPage from './routes/AutomationRulesPage';
import SecuritySettingsPage from './routes/SecuritySettingsPage';
import TenantsPage from './routes/admin/TenantsPage';
import DomainsPage from './routes/admin/DomainsPage';
import IntegrationSettingsPage from './routes/admin/IntegrationSettingsPage';
import UsersPage from './routes/admin/UsersPage';
import PackagesPage from './routes/admin/PackagesPage';

// "/" untuk pengunjung belum login = landing page publik. Untuk user yang sudah login,
// redirect ke dashboard ringkasan (sama untuk semua role, lihat DashboardPage).
function Home() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="page-loading">Memuat…</div>;
  }
  if (!user) {
    return <LandingPage />;
  }

  return <Navigate to="/dashboard" replace />;
}

// Rute tak dikenal ("*") tetap diarahkan ke halaman yang relevan, bukan landing page.
function NotFoundRedirect() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="page-loading">Memuat…</div>;
  }
  return <Navigate to={user ? '/dashboard' : '/login'} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route element={<RoleRoute allow={['end_user', 'tenant_admin', 'super_admin']} />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/inbox" element={<InboxPage />} />
                <Route path="/template" element={<TemplatePage />} />
              </Route>
              <Route element={<RoleRoute allow={['end_user', 'tenant_admin', 'super_admin']} />}>
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/automation-rules" element={<AutomationRulesPage />} />
                <Route path="/security" element={<SecuritySettingsPage />} />
              </Route>
              <Route element={<RoleRoute allow={['super_admin']} />}>
                <Route path="/admin/tenants" element={<TenantsPage />} />
              </Route>
              <Route element={<RoleRoute allow={['super_admin', 'tenant_admin']} />}>
                <Route path="/admin/domains" element={<DomainsPage />} />
                <Route path="/admin/users" element={<UsersPage />} />
                <Route path="/admin/packages" element={<PackagesPage />} />
              </Route>
              <Route element={<RoleRoute allow={['tenant_admin', 'super_admin']} />}>
                <Route path="/admin/integrations" element={<IntegrationSettingsPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="/" element={<Home />} />
          <Route path="*" element={<NotFoundRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
