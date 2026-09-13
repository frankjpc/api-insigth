import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import PlayerDashboard from './pages/PlayerDashboard';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  const { user } = useAuth();

  if (!user) return <Login />;
  if (user.rol === 'admin') return <AdminDashboard />;
  return <PlayerDashboard />;
}
