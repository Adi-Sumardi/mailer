import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import RoleRoute from './routes/RoleRoute';
import AppLayout from './components/AppLayout';
import LoginPage from './routes/LoginPage';
import RegisterPage from './routes/RegisterPage';
import InboxPage from './routes/InboxPage';
import CalendarPage from './routes/CalendarPage';
import TasksPage from './routes/TasksPage';
import AutomationRulesPage from './routes/AutomationRulesPage';
import TenantsPage from './routes/admin/TenantsPage';
import DomainsPage from './routes/admin/DomainsPage';
import IntegrationSettingsPage from './routes/admin/IntegrationSettingsPage';
import UsersPage from './routes/admin/UsersPage';
import PackagesPage from './routes/admin/PackagesPage';

// Redirect default ("/") ke halaman pertama yang relevan untuk role user yang login —
// super_admin tidak punya mailbox, jadi tidak boleh diarahkan ke /inbox (lihat bug 500
// yang pernah terjadi sebelum ini ada).
function HomeRedirect() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="page-loading">Memuat…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const target =
    user.role === 'super_admin' ? '/admin/tenants' : user.role === 'tenant_admin' ? '/admin/domains' : '/inbox';
  return <Navigate to={target} replace />;
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
                <Route path="/inbox" element={<InboxPage />} />
              </Route>
              <Route element={<RoleRoute allow={['end_user', 'tenant_admin', 'super_admin']} />}>
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/automation-rules" element={<AutomationRulesPage />} />
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

          <Route path="/" element={<HomeRedirect />} />
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
