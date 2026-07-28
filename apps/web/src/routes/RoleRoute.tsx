import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, type CurrentUser } from '../context/AuthContext';

interface RoleRouteProps {
  allow: CurrentUser['role'][];
}

// Membatasi akses route berdasarkan role — dipasang di dalam ProtectedRoute
// (jadi user.tidak null di titik ini).
export default function RoleRoute({ allow }: RoleRouteProps) {
  const { user } = useAuth();

  if (!user || !allow.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
