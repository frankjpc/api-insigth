import { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import PlayerDashboard from './pages/PlayerDashboard';
import AdminDashboard from './pages/AdminDashboard';

const SLOW_MS = 4000; // Si tarda más de 4 seg mostrar aviso de servidor dormido

export default function App() {
  const { user, validating } = useAuth();
  const [slowServer, setSlowServer] = useState(false);

  useEffect(() => {
    if (!validating) { setSlowServer(false); return; }
    const t = setTimeout(() => setSlowServer(true), SLOW_MS);
    return () => clearTimeout(t);
  }, [validating]);

  // Mostrar pantalla de carga solo mientras validamos la sesión guardada
  if (validating) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: 'var(--bg-root)',
      }}>
        <span className="spinner" style={{ width: 40, height: 40 }} />
        {slowServer && (
          <p style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.8rem',
            color: 'var(--volt)',
            textAlign: 'center',
            maxWidth: 280,
            lineHeight: 1.6,
          }}>
            ⚡ Despertando el servidor…<br />
            <span style={{ color: 'var(--text-muted)' }}>
              El servidor entra en reposo tras 15 min de inactividad.<br />
              Tardará ~20 segundos la primera vez.
            </span>
          </p>
        )}
      </div>
    );
  }

  if (!user) return <Login />;
  if (user.rol === 'admin') return <AdminDashboard />;
  return <PlayerDashboard />;
}
